import { GoogleGenAI } from '@google/genai';
import { prisma } from './prisma';
import { calculatePriorityScore, getPriorityTier } from './priorityEngine';
import { extractTasksFromText, extractTasksFromImage, ExtractedCandidateTask } from './aiExtractor';
import { getLiveGroqModel, getLiveGeminiModel, invalidateModelCache } from './modelManager';

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

const CHAT_SYSTEM_PROMPT = `You are OmniTask AI, a warm, efficient personal task manager.

PERSONALITY:
- Short, high-signal responses (1-3 sentences).
- Use **bold** for task names and dates.
- Use bullet points when listing multiple items.
- Be proactive and helpful.

CAPABILITIES:
1. Extract tasks from conversation, voice, files, and images.
2. Provide priority advice from the user's active database.
3. Reschedule deadlines, mark tasks complete, update priorities.

RULES:
- When user describes something they need to do, extract it as candidate task cards.
- When user chats casually or asks questions, provide a friendly conversational answer.
- Never invent tasks the user didn't mention.`;

// Fuzzy matching user input against database task titles
function findBestMatchingTask(pendingTasks: any[], userText: string): any | null {
  const lowerText = userText.toLowerCase();
  
  const directMatch = pendingTasks.find(t => lowerText.includes(t.title.toLowerCase()) || t.title.toLowerCase().includes(lowerText));
  if (directMatch) return directMatch;

  const stopWords = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'need', 'mark', 'finish', 'completed', 'done', 'reschedule', 'postpone', 'move', 'change', 'date', 'deadline', 'task', 'report', 'please', 'can', 'you']);
  const userWords = lowerText.split(/\W+/).filter(w => w.length > 2 && !stopWords.has(w));
  if (userWords.length === 0) return null;

  let bestTask = null;
  let maxMatches = 0;

  for (const task of pendingTasks) {
    const taskTitleWords = task.title.toLowerCase().split(/\W+/);
    let matchCount = 0;
    for (const w of userWords) {
      if (taskTitleWords.some((tw: string) => tw.includes(w) || w.includes(tw))) matchCount++;
    }
    if (matchCount > maxMatches) { maxMatches = matchCount; bestTask = task; }
  }

  return maxMatches > 0 ? bestTask : null;
}

function parseRelativeDate(text: string): Date {
  const lower = text.toLowerCase();
  const now = new Date();
  const result = new Date(now);

  const inXDaysMatch = lower.match(/in\s+(\d+)\s+days?/);
  if (inXDaysMatch) { result.setDate(now.getDate() + parseInt(inXDaysMatch[1], 10)); return result; }
  if (lower.includes('tomorrow')) { result.setDate(now.getDate() + 1); return result; }
  if (lower.includes('next week') || lower.includes('in 7 days')) { result.setDate(now.getDate() + 7); return result; }

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let targetDayIdx = 0; targetDayIdx < 7; targetDayIdx++) {
    if (lower.includes(dayNames[targetDayIdx])) {
      const currentDayIdx = now.getDay();
      let diff = (targetDayIdx - currentDayIdx + 7) % 7;
      if (diff === 0) diff = 7;
      result.setDate(now.getDate() + diff);
      return result;
    }
  }

  result.setDate(now.getDate() + 2);
  return result;
}

export interface AttachmentItem {
  buffer: Buffer;
  mimeType: string;
  name: string;
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

  // Handle audio transcription
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

  // Process file attachments (PDFs and Images)
  const nonAudioAttachments = allAttachments.filter((att) => !att.mimeType.includes('audio'));
  if (nonAudioAttachments.length > 0) {
    let combinedCandidates: ExtractedCandidateTask[] = [];

    for (const att of nonAudioAttachments) {
      if (att.mimeType.includes('pdf')) {
        try {
          const pdfParse = require('pdf-parse');
          const parsedPdf = await pdfParse(att.buffer);
          const pdfText = parsedPdf.text || `PDF: ${att.name}`;
          combinedCandidates.push(...await extractTasksFromText(pdfText, userTimezone, userDateISO));
        } catch (err) { console.error(`PDF error (${att.name}):`, err); }
      } else if (att.mimeType.includes('image')) {
        try {
          const base64Image = att.buffer.toString('base64');
          combinedCandidates.push(...await extractTasksFromImage(base64Image, att.mimeType, userTimezone, userDateISO));
        } catch (err) { console.error(`Image error (${att.name}):`, err); }
      }
    }

    const count = combinedCandidates.length;
    const fileNames = nonAudioAttachments.map((a) => a.name).join(', ');
    const contentText = count > 0
      ? `Analyzed **${fileNames}** and extracted **${count} task${count > 1 ? 's' : ''}**. Click **Add** to save:`
      : `Reviewed **${fileNames}** but found no explicit action items.`;

    return {
      role: 'assistant',
      content: contentText,
      attachmentName: nonAudioAttachments[0]?.name,
      attachmentType: nonAudioAttachments[0]?.mimeType.includes('pdf') ? 'pdf' : 'image',
      candidateTasks: count > 0 ? combinedCandidates : undefined,
    };
  }

  const lower = userText.toLowerCase().trim();

  // Intent: Recommendations
  if (
    lower.includes('what should i do') || lower.includes('what to do') ||
    lower.includes('recommend') || lower.includes('where to start') ||
    lower.includes('due soon') || lower.includes('next up') ||
    lower.includes('priorit') || lower.includes('what\'s next') ||
    lower.includes('my tasks') || lower.includes('show tasks')
  ) {
    const pendingTasks = await prisma.task.findMany({
      where: { status: 'PENDING', parentTaskId: null },
      include: { subject: true },
      orderBy: [{ priorityScore: 'desc' }, { deadline: 'asc' }],
      take: 7,
    });

    if (pendingTasks.length === 0) {
      return { role: 'assistant', content: `You're all caught up! 🎉 No pending tasks. Tell me about anything new you need to handle.` };
    }

    const topTask = pendingTasks[0];
    const tier = getPriorityTier(topTask.priorityScore);
    
    let reply = `Here is your priority queue:\n\n`;
    pendingTasks.forEach((t, i) => {
      const tTier = getPriorityTier(t.priorityScore);
      const deadlineStr = t.deadline ? ` — due ${new Date(t.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : '';
      const priorityEmoji = tTier.label === 'Critical' ? '🔴' : tTier.label === 'High' ? '🟠' : tTier.label === 'Medium' ? '🟢' : '⚪';
      reply += `${i + 1}. ${priorityEmoji} **${t.title}**${deadlineStr}\n`;
    });
    
    reply += `\nRecommended focus right now: **${topTask.title}** (${tier.label} priority).`;

    return { role: 'assistant', content: reply, taskActionTaken: 'QUERY_RECOMMENDATIONS' };
  }

  // Intent: Task Completion
  if (lower.startsWith('mark ') || lower.startsWith('finish ') || lower.startsWith('completed ') || lower.includes('done with') || lower.includes('finished ')) {
    const pendingTasks = await prisma.task.findMany({ where: { status: 'PENDING' } });
    const target = findBestMatchingTask(pendingTasks, lower);
    if (target) {
      await prisma.task.update({
        where: { id: target.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      return { role: 'assistant', content: `Marked **"${target.title}"** as completed! ✅`, taskActionTaken: 'TASK_COMPLETED' };
    }
  }

  // Intent: Rescheduling
  if (lower.startsWith('reschedule ') || lower.startsWith('postpone ') || lower.includes('move ') || lower.includes('change deadline') || lower.includes('push back')) {
    const pendingTasks = await prisma.task.findMany({ where: { status: 'PENDING' } });
    const target = findBestMatchingTask(pendingTasks, lower);
    if (target) {
      const newDate = parseRelativeDate(lower);
      await prisma.task.update({
        where: { id: target.id },
        data: { deadline: newDate, userModified: true },
      });
      return {
        role: 'assistant',
        content: `Rescheduled **"${target.title}"** to **${newDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}** 📅`,
        taskActionTaken: 'TASK_RESCHEDULED',
      };
    }
  }

  // Intent: Update Description / Notes via Chat
  if (
    lower.includes('change description') ||
    lower.includes('update description') ||
    lower.includes('set description') ||
    lower.includes('add description') ||
    lower.includes('change note') ||
    lower.includes('update note') ||
    lower.includes('add note')
  ) {
    const pendingTasks = await prisma.task.findMany({ where: { status: 'PENDING' } });
    const target = findBestMatchingTask(pendingTasks, lower);
    if (target) {
      let newDesc = '';
      const splitMatch = userText.match(/(?:to|as|:)\s*["']?([^"']+)["']?$/i);
      if (splitMatch && splitMatch[1]) {
        newDesc = splitMatch[1].trim();
      } else {
        newDesc = userText.replace(/.*(change|update|set|add)\s+(the\s+)?(description|notes?)\s+(of|for|to)?\s+[^:]+[:\s]/i, '').trim();
      }
      newDesc = newDesc.replace(/^:\s*/, '').trim();

      if (newDesc) {
        await prisma.task.update({
          where: { id: target.id },
          data: { description: newDesc, userModified: true },
        });
        return {
          role: 'assistant',
          content: `Updated notes for **"${target.title}"** to: *"${newDesc}"* 📝`,
          taskActionTaken: 'TASK_UPDATED',
        };
      }
    }
  }

  // 1. Cancellation / Dismissal
  if (['cancel', 'stop', 'dismiss', 'nevermind', 'never mind', 'forget it', 'clear'].includes(lower)) {
    return {
      role: 'assistant',
      content: `Understood! I've cancelled that. Tell me whenever you'd like to add or manage your tasks.`,
    };
  }

  // 2. Greetings & Casual Small Talk
  const isGreeting = /^(hi|hello|hey|good morning|good evening|good afternoon|howdy|sup|yo|hola|greetings|how are you|how r u|how are u|how's it going|what's up|how do you do)\b/i.test(lower);
  const isMetaQuestion =
    (lower.includes('will u') || lower.includes('will you') || lower.includes('can u') ||
     lower.includes('can you') || lower.includes('how do you') || lower.includes('what can you') ||
     lower.includes('who are you') || lower.includes('what are you') || lower.includes('help me') ||
     lower.includes('tell me') || lower.includes('how are you')) &&
    !lower.includes('buy') && !lower.includes('pay') && !lower.includes('submit') && !lower.includes('finish') && !lower.includes('prepare');

  if (isGreeting || isMetaQuestion) {
    return await generateChatResponse(userText, history);
  }

  // 3. Actionable task detection
  const isTooVague = lower.length <= 2 || ['ok', 'yes', 'no', 'k', 'lol', 'haha', 'hmm', 'nice', 'cool', 'thanks', 'thank you', 'thx', 'ty'].includes(lower);
  const isConfirmation = ['yes', 'sure', 'yeah', 'yep', 'go ahead', 'do it', 'create them', 'add them'].some(c => lower === c || lower.startsWith(c));

  if (!isTooVague || isConfirmation) {
    let textToExtract = userText;
    
    if (isConfirmation && history && history.length > 0) {
      const lastUserMsg = [...history].reverse().find(
        (h) => h.role === 'user' && h.content && h.content.trim() !== userText.trim() && h.content.length > 10
      );
      if (lastUserMsg) textToExtract = lastUserMsg.content;
    }

    const candidateTasks = await extractTasksFromText(textToExtract, userTimezone, userDateISO);

    if (candidateTasks && candidateTasks.length > 0) {
      const count = candidateTasks.length;
      return {
        role: 'assistant',
        content: count > 1
          ? `Found **${count} tasks** in your request. Click **Add** to confirm:`
          : `Review the task below and click **Add** to save it:`,
        candidateTasks,
      };
    }
  }

  return await generateChatResponse(userText, history);
}

async function generateChatResponse(userText: string, history: ChatHistoryItem[]): Promise<ChatMessagePayload> {
  let allPendingTasks: any[] = [];
  try {
    allPendingTasks = await prisma.task.findMany({ where: { status: 'PENDING' }, take: 10 });
  } catch {}

  const taskContext = allPendingTasks.length > 0
    ? `\nUSER'S CURRENT PENDING TASKS:\n` + allPendingTasks.map(t => 
        `- "${t.title}" (Due: ${t.deadline ? new Date(t.deadline).toLocaleDateString('en-GB') : 'No deadline'})`
      ).join('\n')
    : `\nUSER HAS NO PENDING TASKS.`;

  const systemPrompt = `${CHAT_SYSTEM_PROMPT}\n${taskContext}`;

  // 1. Dynamic Groq Live Chat
  const groqApiKey = process.env.GROQ_API_KEY;
  if (groqApiKey) {
    try {
      const liveModel = await getLiveGroqModel(groqApiKey);
      const { Groq } = require('groq-sdk');
      const groq = new Groq({ apiKey: groqApiKey });
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          ...history.slice(-8).map(h => ({ role: h.role, content: h.content })),
          { role: 'user', content: userText },
        ],
        model: liveModel,
        temperature: 0.6,
        max_tokens: 500,
      });
      const reply = chatCompletion.choices[0]?.message?.content;
      if (reply) return { role: 'assistant', content: reply };
    } catch (e: any) {
      if (e?.status === 404 || e?.code === 'model_not_found') {
        invalidateModelCache('groq');
      }
      console.warn('Groq chat error, falling back:', e);
    }
  }

  // 2. Dynamic Gemini Live Chat
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (geminiApiKey) {
    try {
      const liveModel = await getLiveGeminiModel(geminiApiKey);
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const res = await ai.models.generateContent({
        model: liveModel,
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nUSER: ${userText}` }] },
        ],
      });
      if (res.text) return { role: 'assistant', content: res.text };
    } catch (e: any) {
      if (e?.status === 404) {
        invalidateModelCache('gemini');
      }
      console.warn('Gemini chat error, falling back:', e);
    }
  }

  return { role: 'assistant', content: `I'm here to help! Tell me about any upcoming tasks or ask "What should I do now?" to prioritize.` };
}
