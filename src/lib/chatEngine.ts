import { GoogleGenAI } from '@google/genai';
import { prisma } from './prisma';
import { calculatePriorityScore, getPriorityTier } from './priorityEngine';
import { getLiveGroqModel, getLiveGeminiModel, invalidateModelCache } from './modelManager';
import { extractTasksFromImage, ExtractedCandidateTask } from './aiExtractor';

export interface ChatMessagePayload {
  role: 'user' | 'assistant';
  content: string;
  attachmentName?: string;
  attachmentType?: 'image' | 'pdf' | 'audio';
  candidateTasks?: ExtractedCandidateTask[];
  taskActionTaken?: string;
}

export interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface AttachmentItem {
  buffer: Buffer;
  mimeType: string;
  name: string;
}

interface CognitiveAIResponse {
  reply: string;
  action: 'CHAT' | 'EXTRACT_TASKS' | 'COMPLETE_TASK' | 'RESCHEDULE_TASK' | 'UPDATE_DESCRIPTION' | 'MULTI_ACTION';
  extractedTasks?: ExtractedCandidateTask[];
  completeTaskId?: string;
  reschedule?: {
    taskId: string;
    newDeadlineISO: string;
  };
  updateDescription?: {
    taskId: string;
    newDescription: string;
  };
}

export async function processUserChatMessage(
  userText: string,
  attachmentBuffer?: Buffer | null,
  attachmentMimeType?: string | null,
  attachmentName?: string | null,
  history: ChatHistoryItem[] = [],
  allAttachments: AttachmentItem[] = [],
  userTimezone?: string,
  userDateISO?: string
): Promise<ChatMessagePayload> {
  if (allAttachments.length === 0 && attachmentBuffer && attachmentMimeType && attachmentName) {
    allAttachments = [{ buffer: attachmentBuffer, mimeType: attachmentMimeType, name: attachmentName }];
  }

  // 1. Handle audio transcription if present
  for (const att of allAttachments) {
    if (att.mimeType.includes('audio') && process.env.GROQ_API_KEY) {
      try {
        const { Groq } = require('groq-sdk');
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const uint8Array = new Uint8Array(att.buffer);
        const voiceFile = new File([uint8Array], att.name || 'recording.webm', { type: att.mimeType });
        const transcription = await groq.audio.transcriptions.create({ file: voiceFile, model: 'whisper-large-v3' });
        if (transcription.text) userText += (userText ? '\n' : '') + transcription.text;
      } catch (err) {
        console.error('Audio transcription error:', err);
      }
    }
  }

  // 2. Handle image attachments with Vision
  const imageAttachments = allAttachments.filter((att) => att.mimeType.includes('image'));
  if (imageAttachments.length > 0) {
    let combinedCandidates: ExtractedCandidateTask[] = [];
    for (const att of imageAttachments) {
      try {
        const base64Image = att.buffer.toString('base64');
        combinedCandidates.push(...await extractTasksFromImage(base64Image, att.mimeType, userTimezone, userDateISO));
      } catch (err) { console.error('Image error:', err); }
    }
    const count = combinedCandidates.length;
    return {
      role: 'assistant',
      content: count > 0
        ? `Analyzed image and extracted **${count} task${count > 1 ? 's' : ''}**. Click **Add** to confirm:`
        : `Reviewed your image, but found no explicit action items.`,
      attachmentName: imageAttachments[0]?.name,
      attachmentType: 'image',
      candidateTasks: count > 0 ? combinedCandidates : undefined,
    };
  }

  // 3. Handle PDF attachments
  const pdfAttachments = allAttachments.filter((att) => att.mimeType.includes('pdf'));
  if (pdfAttachments.length > 0) {
    for (const att of pdfAttachments) {
      try {
        const pdfParse = require('pdf-parse');
        const parsedPdf = await pdfParse(att.buffer);
        userText += `\n[DOCUMENT CONTENT: ${att.name}]\n${parsedPdf.text}`;
      } catch (err) { console.error('PDF parse error:', err); }
    }
  }

  // 4. Fetch live database state for grounding
  let pendingTasks: any[] = [];
  try {
    pendingTasks = await prisma.task.findMany({
      where: { status: 'PENDING' },
      orderBy: [{ priorityScore: 'desc' }, { deadline: 'asc' }],
      take: 15,
    });
  } catch (err) {
    console.error('Database fetch error:', err);
  }

  // 5. Build dynamic 14-day calendar anchor
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let now = new Date();
  if (userDateISO && /^\d{4}-\d{2}-\d{2}/.test(userDateISO)) {
    const parts = userDateISO.split('T')[0].split('-').map(Number);
    now = new Date(parts[0], parts[1] - 1, parts[2]);
  }
  const tz = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const todayName = dayNames[now.getDay()];
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const calendarRef = [];
  for (let i = 0; i <= 14; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const dIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    calendarRef.push(`${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dayNames[d.getDay()]}: ${dIso}`);
  }

  const systemCognitivePrompt = `You are OmniTask AI, an elite, high-IQ executive task architect and productivity strategist.

CORE MISSION:
You help high-performing professionals and students turn unstructured thoughts, deadlines, and daily chaos into razor-sharp prioritized execution.

COMMUNICATION STYLE:
- **Sharp, high-signal, executive formatting**: Use crisp paragraphs, strategic bolding for deadlines and task titles, and clean bullet points.
- **Productivity Coaching**: When advising what to do next, provide a clear, actionable sequence (e.g. 1. Immediate Focus, 2. Quick Win, 3. High Leverage) with time estimates and clear reasoning.
- **Nuanced conversationalist**: If the user chats casually, asks meta questions, or makes small talk, be warm, clever, and engaging.
- **Cancellation handling**: If user says "cancel", "nevermind", or "scratch that", smoothly acknowledge with zero friction.

CURRENT CONTEXT:
- Timezone: ${tz}
- Today's Date: ${todayISO} (${todayName})
- 14-Day Calendar Anchor:
${calendarRef.join('\n')}

USER'S LIVE ACTIVE TASKS (from database):
${pendingTasks.length === 0 ? 'No pending tasks currently in database.' : pendingTasks.map((t, idx) => 
  `#${idx + 1} [ID: "${t.id}"] "${t.title}" | Deadline: ${t.deadline ? new Date(t.deadline).toISOString().split('T')[0] : 'None'} | Importance: ${t.importance}/5 | Type: ${t.taskType} | Est: ${t.estimatedEffortMins || 30}m | Notes: "${t.description || ''}"`
).join('\n')}

YOUR INSTRUCTIONS:
Analyze the user's message in context of their pending tasks and conversation history. Determine the appropriate action and respond in structured JSON.

ACTION TYPES:
1. "CHAT": When the user is making small talk ("how are you", "hi"), asking a question ("what should I do now", "why did you prioritize X"), talking casually, giving feedback, or saying cancellation words ("cancel", "stop", "nevermind"). Give a smart, empathetic, direct response (1-3 sentences).
2. "EXTRACT_TASKS": When the user is describing one or more new tasks/chores/work items they need to do. Extract them as structured tasks with clean titles and resolved dates. DO NOT extract tasks for casual small talk or cancellations!
3. "COMPLETE_TASK": When the user asks to complete, finish, or mark off an existing task in their database. Provide the completeTaskId.
4. "RESCHEDULE_TASK": When the user asks to move, delay, postpone, or change the deadline of an existing task. Provide the task ID and resolved newDeadlineISO.
5. "UPDATE_DESCRIPTION": When the user asks to update notes or description for an existing task. Provide the task ID and newDescription.

RESPONSE JSON SCHEMA:
\`\`\`json
{
  "reply": "Executive, direct, and helpful response. Use markdown bold for task titles and dates.",
  "action": "CHAT" | "EXTRACT_TASKS" | "COMPLETE_TASK" | "RESCHEDULE_TASK" | "UPDATE_DESCRIPTION",
  "extractedTasks": [
    {
      "title": "Clean concise task title",
      "description": "Optional notes or details",
      "taskType": "WORK" | "PROJECT" | "FINANCE" | "HEALTH" | "ERRAND" | "ASSIGNMENT" | "PERSONAL",
      "deadlineISO": "YYYY-MM-DD or null",
      "importance": 1 to 5,
      "estimatedEffortMins": 30
    }
  ],
  "completeTaskId": "task-id-here (if completing)",
  "reschedule": {
    "taskId": "task-id-here",
    "newDeadlineISO": "YYYY-MM-DD"
  },
  "updateDescription": {
    "taskId": "task-id-here",
    "newDescription": "updated note content"
  }
}
\`\`\`

Return ONLY the JSON object inside \`\`\`json ... \`\`\`.`;

  // 6. Execute Autonomous Unified LLM Reasoning
  let cognitiveResult: CognitiveAIResponse | null = null;

  // Try Groq LPU first
  const groqApiKey = process.env.GROQ_API_KEY;
  if (groqApiKey) {
    try {
      const liveModel = await getLiveGroqModel(groqApiKey);
      const { Groq } = require('groq-sdk');
      const groq = new Groq({ apiKey: groqApiKey });
      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemCognitivePrompt },
          ...history.slice(-8).map((h) => ({ role: h.role, content: h.content })),
          { role: 'user', content: userText },
        ],
        model: liveModel,
        temperature: 0.2,
      });
      cognitiveResult = parseCognitiveResponse(completion.choices[0]?.message?.content || '');
    } catch (e: any) {
      if (e?.status === 404 || e?.code === 'model_not_found') invalidateModelCache('groq');
      console.warn('Groq cognitive error, falling back:', e);
    }
  }

  // Try Gemini fallback
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!cognitiveResult && geminiApiKey) {
    try {
      const liveModel = await getLiveGeminiModel(geminiApiKey);
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const res = await ai.models.generateContent({
        model: liveModel,
        contents: [
          { role: 'user', parts: [{ text: `${systemCognitivePrompt}\n\nUSER MESSAGE:\n${userText}` }] },
        ],
      });
      cognitiveResult = parseCognitiveResponse(res.text || '');
    } catch (e: any) {
      if (e?.status === 404) invalidateModelCache('gemini');
      console.warn('Gemini cognitive error:', e);
    }
  }

  // 7. Execute Database Actions if LLM determined an action
  if (cognitiveResult) {
    // Action: Complete Task
    if (cognitiveResult.action === 'COMPLETE_TASK' && cognitiveResult.completeTaskId) {
      try {
        await prisma.task.update({
          where: { id: cognitiveResult.completeTaskId },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
        return {
          role: 'assistant',
          content: cognitiveResult.reply,
          taskActionTaken: 'TASK_COMPLETED',
        };
      } catch (err) {
        console.error('Complete task DB error:', err);
      }
    }

    // Action: Reschedule Task
    if (cognitiveResult.action === 'RESCHEDULE_TASK' && cognitiveResult.reschedule?.taskId && cognitiveResult.reschedule?.newDeadlineISO) {
      try {
        await prisma.task.update({
          where: { id: cognitiveResult.reschedule.taskId },
          data: {
            deadline: new Date(cognitiveResult.reschedule.newDeadlineISO),
            userModified: true,
          },
        });
        return {
          role: 'assistant',
          content: cognitiveResult.reply,
          taskActionTaken: 'TASK_RESCHEDULED',
        };
      } catch (err) {
        console.error('Reschedule task DB error:', err);
      }
    }

    // Action: Update Description
    if (cognitiveResult.action === 'UPDATE_DESCRIPTION' && cognitiveResult.updateDescription?.taskId) {
      try {
        await prisma.task.update({
          where: { id: cognitiveResult.updateDescription.taskId },
          data: {
            description: cognitiveResult.updateDescription.newDescription,
            userModified: true,
          },
        });
        return {
          role: 'assistant',
          content: cognitiveResult.reply,
          taskActionTaken: 'TASK_UPDATED',
        };
      } catch (err) {
        console.error('Update description DB error:', err);
      }
    }

    // Action: Extract Tasks
    if (cognitiveResult.action === 'EXTRACT_TASKS' && cognitiveResult.extractedTasks && cognitiveResult.extractedTasks.length > 0) {
      return {
        role: 'assistant',
        content: cognitiveResult.reply,
        candidateTasks: cognitiveResult.extractedTasks,
      };
    }

    // Action: Conversational Chat
    return {
      role: 'assistant',
      content: cognitiveResult.reply || "I'm here to help manage your tasks. What would you like to do?",
    };
  }

  // Emergency offline response
  return {
    role: 'assistant',
    content: "I'm ready to organize your day. Tell me what tasks you need to get done, or ask me how to prioritize your workload.",
  };
}

function parseCognitiveResponse(rawText: string): CognitiveAIResponse | null {
  try {
    let clean = rawText.trim();
    if (clean.includes('```json')) {
      clean = clean.split('```json')[1].split('```')[0].trim();
    } else if (clean.includes('```')) {
      clean = clean.split('```')[1].split('```')[0].trim();
    }
    const parsed = JSON.parse(clean);
    if (parsed && typeof parsed.reply === 'string') {
      return parsed as CognitiveAIResponse;
    }
  } catch (err) {
    try {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]) as CognitiveAIResponse;
      }
    } catch {}
  }
  return null;
}
