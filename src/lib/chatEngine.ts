import { GoogleGenAI } from '@google/genai';
import { prisma } from './prisma';
import { calculatePriorityScore, getPriorityTier } from './priorityEngine';
import { extractTasksFromText, extractTasksFromImage, ExtractedCandidateTask } from './aiExtractor';

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

const CHAT_SYSTEM_PROMPT = `
You are OmniTask AI, a friendly, ultra-helpful personal task and responsibility assistant.
You help the user manage their obligations across work, finance, health, errands, personal projects, and academics.

YOUR CAPABILITIES:
1. Identify actionable tasks from messages, emails, photos, or audio notes.
2. Provide personalized advice on what to prioritize based on active database tasks.
3. Maintain full conversation context with the user across multi-turn exchanges.
`;

// Helper: Fuzzy matching user input against database task titles
function findBestMatchingTask(pendingTasks: any[], userText: string): any | null {
  const lowerText = userText.toLowerCase();
  
  // 1. Direct substring match
  const directMatch = pendingTasks.find(t => lowerText.includes(t.title.toLowerCase()) || t.title.toLowerCase().includes(lowerText));
  if (directMatch) return directMatch;

  // 2. Keyword overlap scoring
  const stopWords = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'need', 'mark', 'finish', 'completed', 'done', 'reschedule', 'postpone', 'move', 'change', 'date', 'deadline', 'task', 'report']);
  const userWords = lowerText.split(/\W+/).filter(w => w.length > 2 && !stopWords.has(w));

  if (userWords.length === 0) return null;

  let bestTask = null;
  let maxMatches = 0;

  for (const task of pendingTasks) {
    const taskTitleWords = task.title.toLowerCase().split(/\W+/);
    let matchCount = 0;
    for (const w of userWords) {
      if (taskTitleWords.some((tw: string) => tw.includes(w) || w.includes(tw))) {
        matchCount++;
      }
    }
    if (matchCount > maxMatches) {
      maxMatches = matchCount;
      bestTask = task;
    }
  }

  return maxMatches > 0 ? bestTask : null;
}

// Helper: Full 7-day relative date parsing engine
function parseRelativeDate(text: string): Date {
  const lower = text.toLowerCase();
  const now = new Date();
  const result = new Date(now);

  // Check "in X days"
  const inXDaysMatch = lower.match(/in\s+(\d+)\s+days?/);
  if (inXDaysMatch) {
    const days = parseInt(inXDaysMatch[1], 10);
    result.setDate(now.getDate() + days);
    return result;
  }

  if (lower.includes('tomorrow')) {
    result.setDate(now.getDate() + 1);
    return result;
  }

  if (lower.includes('next week') || lower.includes('in 7 days')) {
    result.setDate(now.getDate() + 7);
    return result;
  }

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let targetDayIdx = 0; targetDayIdx < 7; targetDayIdx++) {
    const dayName = dayNames[targetDayIdx];
    if (lower.includes(dayName)) {
      const currentDayIdx = now.getDay();
      let diff = (targetDayIdx - currentDayIdx + 7) % 7;
      if (diff === 0) diff = 7; // Next occurrence if today is that day
      result.setDate(now.getDate() + diff);
      return result;
    }
  }

  // Default +2 days boost if no specific day matched
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
  allAttachments: AttachmentItem[] = []
): Promise<ChatMessagePayload> {
  // If single attachment passed without allAttachments array, wrap it
  if (allAttachments.length === 0 && attachmentBuffer && attachmentMimeType && attachmentName) {
    allAttachments = [{ buffer: attachmentBuffer, mimeType: attachmentMimeType, name: attachmentName }];
  }

  // 0. Handle audio transcription if voice note is provided
  for (const att of allAttachments) {
    if (att.mimeType.includes('audio') && process.env.GROQ_API_KEY) {
      try {
        const { Groq } = require('groq-sdk');
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const uint8Array = new Uint8Array(att.buffer);
        const voiceFile = new File([uint8Array], att.name || 'recording.webm', { type: att.mimeType });
        const transcription = await groq.audio.transcriptions.create({
          file: voiceFile,
          model: 'whisper-large-v3',
        });
        if (transcription.text) {
          userText += (userText ? '\n' : '') + transcription.text;
        }
      } catch (err) {
        console.error('Groq Whisper audio transcription error:', err);
      }
    }
  }

  // 1. Process all file attachments (PDFs and Images)
  const nonAudioAttachments = allAttachments.filter((att) => !att.mimeType.includes('audio'));
  if (nonAudioAttachments.length > 0) {
    let combinedCandidates: ExtractedCandidateTask[] = [];

    for (const att of nonAudioAttachments) {
      if (att.mimeType.includes('pdf')) {
        try {
          const pdfParse = require('pdf-parse');
          const parsedPdf = await pdfParse(att.buffer);
          const pdfText = parsedPdf.text || `PDF File: ${att.name}`;
          const extracted = await extractTasksFromText(pdfText);
          combinedCandidates.push(...extracted);
        } catch (err) {
          console.error(`PDF parsing error for ${att.name}:`, err);
        }
      } else if (att.mimeType.includes('image')) {
        try {
          const base64Image = att.buffer.toString('base64');
          const extracted = await extractTasksFromImage(base64Image, att.mimeType);
          combinedCandidates.push(...extracted);
        } catch (err) {
          console.error(`Image OCR error for ${att.name}:`, err);
        }
      }
    }

    const count = combinedCandidates.length;
    const fileNames = nonAudioAttachments.map((a) => `"${a.name}"`).join(', ');
    const contentText = count > 0
      ? `I analyzed your ${nonAudioAttachments.length} file${nonAudioAttachments.length > 1 ? 's' : ''} (${fileNames}) and extracted ${count} task${count > 1 ? 's' : ''}. Review and confirm below!`
      : `I reviewed your file${nonAudioAttachments.length > 1 ? 's' : ''} (${fileNames}), but didn't find explicit tasks. Feel free to type details!`;

    return {
      role: 'assistant',
      content: contentText,
      attachmentName: nonAudioAttachments[0]?.name,
      attachmentType: nonAudioAttachments[0]?.mimeType.includes('pdf') ? 'pdf' : 'image',
      candidateTasks: combinedCandidates.length > 0 ? combinedCandidates : undefined,
    };
  }

  const lower = userText.toLowerCase().trim();

  // 2. Intent: Recommendations / "What should I do now?"
  if (
    lower.includes('what should i do') ||
    lower.includes('what to do') ||
    lower.includes('recommend') ||
    lower.includes('where to start') ||
    lower.includes('due soon') ||
    lower.includes('next up')
  ) {
    const pendingTasks = await prisma.task.findMany({
      where: { status: 'PENDING', parentTaskId: null },
      include: { subject: true, subtasks: true },
      orderBy: [{ priorityScore: 'desc' }, { deadline: 'asc' }],
      take: 5,
    });

    if (pendingTasks.length === 0) {
      return {
        role: 'assistant',
        content: `You have zero pending tasks! 🎉 Everything is complete. Tell me if you need to add any new commitments or errands.`,
      };
    }

    const topTask = pendingTasks[0];
    const tier = getPriorityTier(topTask.priorityScore);
    let reply = `I recommend starting with **${topTask.title}** (Priority: ${tier.label}).`;
    if (topTask.deadline) {
      reply += ` It's due on ${new Date(topTask.deadline).toLocaleDateString('en-GB')}.`;
    }
    if (pendingTasks.length > 1) {
      reply += `\n\nHere are your top ${pendingTasks.length} pending obligations sorted by priority:`;
    }

    return {
      role: 'assistant',
      content: reply,
      taskActionTaken: 'QUERY_RECOMMENDATIONS',
    };
  }

  // 3. Intent: Task Completion (using Fuzzy Task Matching)
  if (lower.startsWith('mark ') || lower.startsWith('finish ') || lower.startsWith('completed ') || lower.includes('done with')) {
    const pendingTasks = await prisma.task.findMany({ where: { status: 'PENDING' } });
    const target = findBestMatchingTask(pendingTasks, lower);
    if (target) {
      await prisma.task.update({
        where: { id: target.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      return {
        role: 'assistant',
        content: `Awesome job! I marked **"${target.title}"** as completed! ✅`,
        taskActionTaken: 'TASK_COMPLETED',
      };
    }
  }

  // 4. Intent: Conversational Rescheduling (using Fuzzy Matching + Full 7-Day Parser)
  if (lower.startsWith('reschedule ') || lower.startsWith('postpone ') || lower.includes('move ') || lower.includes('change deadline')) {
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
        content: `Rescheduled **"${target.title}"** to **${newDate.toLocaleDateString('en-GB')}**! 🗓️`,
        taskActionTaken: 'TASK_RESCHEDULED',
      };
    }
  }

  // 5. Intent: Meta-Questions & Capability Queries (Zero Dummy Card Guardrail)
  const forceAssign =
    lower.includes('just add') ||
    lower.includes('assign now') ||
    lower.includes('create task') ||
    lower.includes('add it') ||
    lower.includes('add anyway') ||
    lower.includes('create anyway');

  const isMetaQuestion =
    lower.includes('will u') ||
    lower.includes('will you') ||
    lower.includes('can u') ||
    lower.includes('can you') ||
    lower.includes('how do you') ||
    lower.includes('what can you') ||
    (lower.includes('multiple task') && !lower.includes('by') && !lower.includes('due') && !lower.includes('tomorrow'));

  if (isMetaQuestion && !forceAssign) {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (groqApiKey) {
      try {
        const { Groq } = require('groq-sdk');
        const groq = new Groq({ apiKey: groqApiKey });
        
        const systemMsg = `${CHAT_SYSTEM_PROMPT}\n\nThe user is asking a meta-question or capability question about adding tasks. Answer dynamically, helpfully, and concisely (1-2 sentences). Encourage them to paste, type, attach a photo/PDF, or record a voice note! DO NOT output structured task cards.`;
        const groqMessages = [
          { role: 'system', content: systemMsg },
          ...history.map(h => ({ role: h.role, content: h.content })),
          { role: 'user', content: userText },
        ];

        const chatCompletion = await groq.chat.completions.create({
          messages: groqMessages,
          model: 'llama-3.3-70b-versatile',
          temperature: 0.7,
        });

        const dynamicReply = chatCompletion.choices[0]?.message?.content;
        if (dynamicReply) {
          return {
            role: 'assistant',
            content: dynamicReply,
          };
        }
      } catch (err) {
        console.error('Meta-question Groq dynamic chat error:', err);
      }
    }

    return {
      role: 'assistant',
      content: `Yes, absolutely! I can handle all your tasks. Feel free to list them out here, attach a photo/PDF of your notes, or record a voice note, and I will organize them for you! 🚀`,
    };
  }

  // Vague Single-Word Guardrail
  const vagueWords = ['study', 'work', 'project', 'bill', 'assignment', 'meeting', 'todo', 'task', 'homework'];
  const isVagueSingleWord = vagueWords.includes(lower) || (lower.length < 12 && !lower.includes('by') && !lower.includes('due') && !lower.includes('tomorrow'));

  const isConfirmation =
    lower.includes('yes') ||
    lower.includes('sure') ||
    lower.includes('yeah') ||
    lower.includes('yep') ||
    lower.includes('ok') ||
    lower.includes('create card') ||
    lower.includes('add them') ||
    lower.includes('go ahead');

  // 6. Candidate Task Card Extraction (with multi-task chat confirmation)
  if (!isVagueSingleWord || forceAssign || isConfirmation) {
    // If user is confirming (e.g. "yes", "sure"), look back at history for the original message containing tasks
    let textToExtract = userText;
    if (isConfirmation && history && history.length > 0) {
      const lastUserMsg = [...history].reverse().find((h) => h.role === 'user' && h.content && h.content.trim() !== userText.trim());
      if (lastUserMsg && lastUserMsg.content.length > 10) {
        textToExtract = lastUserMsg.content;
      }
    }

    const candidateTasks = await extractTasksFromText(textToExtract);

    if (candidateTasks && candidateTasks.length > 0) {
      const count = candidateTasks.length;

      if (count > 1 && !forceAssign && !isConfirmation) {
        const titlesList = candidateTasks.map((t) => `• **${t.title}**`).join('\n');
        return {
          role: 'assistant',
          content: `I noticed ${count} potential tasks in your message:\n${titlesList}\n\nShall I generate task cards for these so you can review and add them to your list?`,
        };
      }

      return {
        role: 'assistant',
        content: count > 1
          ? `Here are your ${count} task cards below. Review and click **Confirm Task** on each to save them to your active tasks!`
          : `I extracted your task. Review the details below and click **Confirm Task** to save it to your list!`,
        candidateTasks,
      };
    }
  }

  // 7. Open Conversational Chat via Groq Llama 3.3 70B & Gemini (with FULL Multi-Turn History & DB Memory)
  const allPendingTasks = await prisma.task.findMany({
    where: { status: 'PENDING' },
    take: 15,
  });

  const taskContextString = allPendingTasks.length > 0
    ? `CURRENT PENDING TASKS IN USER DATABASE:\n` + allPendingTasks.map(t => `- "${t.title}" (Due: ${t.deadline ? new Date(t.deadline).toLocaleDateString('en-GB') : 'No deadline'})`).join('\n')
    : `CURRENT PENDING TASKS: None`;

  const contextualSystemPrompt = `${CHAT_SYSTEM_PROMPT}\n\n${taskContextString}`;

  const groqApiKey = process.env.GROQ_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (groqApiKey) {
    try {
      const { Groq } = require('groq-sdk');
      const groq = new Groq({ apiKey: groqApiKey });

      // Pass multi-turn history into Groq Llama 3.3 70B for conversation continuity!
      const groqMessages = [
        { role: 'system', content: contextualSystemPrompt },
        ...history.map(h => ({ role: h.role, content: h.content })),
        { role: 'user', content: userText },
      ];

      const chatCompletion = await groq.chat.completions.create({
        messages: groqMessages,
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
      });

      const reply = chatCompletion.choices[0]?.message?.content;
      if (reply) {
        return {
          role: 'assistant',
          content: reply,
        };
      }
    } catch (e) {
      console.error('Groq chat error, falling back to Gemini:', e);
    }
  }

  if (geminiApiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const res = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [
          { role: 'user', parts: [{ text: `${contextualSystemPrompt}\n\nUSER MESSAGE:\n${userText}` }] },
        ],
      });
      return {
        role: 'assistant',
        content: res.text || "I'm here to help! Tell me about any tasks, deadlines, or ask what you should work on next.",
      };
    } catch (e) {
      console.error('Gemini chat error:', e);
    }
  }

  return {
    role: 'assistant',
    content: `Got it! Tell me about any upcoming deadlines, paste a message, attach a screenshot, or ask me "What should I do now?".`,
  };
}
