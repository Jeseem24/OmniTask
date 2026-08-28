import { GoogleGenAI } from '@google/genai';
import { Groq } from 'groq-sdk';
import { getLiveGroqModel, getLiveGeminiModel, invalidateModelCache } from './modelManager';

export interface ExtractedCandidateTask {
  title: string;
  description?: string;
  taskType?: string;
  deadlineISO?: string | null;
  isDeadlineAmbiguous?: boolean;
  estimatedEffortMins?: number;
  importance?: number;
  confidenceScore?: number;
  subjectCode?: string;
  subjectName?: string;
  subtasks?: Array<string | { title: string; estimatedEffortMins?: number; taskType?: string }>;
  userModified?: boolean;
}

/**
 * Generates an accurate, localized 14-day calendar context anchor prompt.
 */
export function getCalendarContextPrompt(userTimezone?: string, userDateISO?: string): string {
  let now = new Date();
  if (userDateISO) {
    const parsedUserDate = new Date(userDateISO);
    if (!isNaN(parsedUserDate.getTime())) now = parsedUserDate;
  }

  const tz = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = dayNames[now.getDay()];
  const todayISO = now.toISOString().split('T')[0];

  const datesList = [];
  for (let i = 0; i <= 14; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const dayName = dayNames[d.getDay()];
    const iso = d.toISOString().split('T')[0];
    datesList.push(`${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dayName}: ${iso}`);
  }

  return `You are OmniTask's precision task extraction engine. Extract actionable tasks from user input into structured JSON.

USER TIMEZONE: ${tz}
TODAY: ${todayISO} (${todayName})
DATE REFERENCE (Next 14 Days):
${datesList.join('\n')}

CLASSIFICATION TYPES:
- WORK: meetings, office reports, client tasks, emails
- PROJECT: development, building, creative work
- FINANCE: bills, fees, taxes, payments
- HEALTH: doctor appointments, workouts, medications
- ERRAND: shopping, groceries, pickups
- ASSIGNMENT: homework, coursework, study tasks
- PERSONAL: personal goals, routines
- SOCIAL: calls, family, friends
- OTHER: general tasks

RULES:
1. Extract clean, actionable task titles (e.g. "Email supervisor project selection", "Buy groceries").
2. Resolve relative dates like "tomorrow", "this Friday", "next Tuesday" to ISO YYYY-MM-DD using the DATE REFERENCE table. If no date is given, set deadlineISO to null and isDeadlineAmbiguous to true.
3. Assign importance: 1=Low, 3=Normal, 4=High, 5=Critical/Urgent.
4. Always return subtasks as [] unless explicit numbered sub-steps are listed.
5. CRITICAL: If the user input is a greeting, small talk, casual question (e.g. "how are you", "what's up", "who are you"), cancellation keyword ("cancel", "stop", "no"), or does NOT describe an actionable task or duty, return an empty array [] without generating tasks.
6. Always provide a helpful 1-sentence action summary in 'description' explaining the task goal and outcome.
7. Return a valid JSON array of objects inside \`\`\`json ... \`\`\`.

EXAMPLE OUTPUT:
[
  {
    "title": "Email supervisor project selection",
    "description": "Send selection email for mini and final year projects",
    "taskType": "WORK",
    "deadlineISO": "${todayISO}",
    "isDeadlineAmbiguous": false,
    "importance": 4,
    "confidenceScore": 0.95,
    "subtasks": []
  }
]

Return ONLY the JSON array inside \`\`\`json ... \`\`\`.`;
}

export async function extractTasksFromText(
  rawText: string,
  userTimezone?: string,
  userDateISO?: string
): Promise<ExtractedCandidateTask[]> {
  const groqApiKey = process.env.GROQ_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const systemPrompt = getCalendarContextPrompt(userTimezone, userDateISO);

  // 1. Dynamic Groq Live Extraction with Rate-Limit (429) & Model (404) auto-handling
  if (groqApiKey) {
    try {
      const liveModel = await getLiveGroqModel(groqApiKey);
      const groq = new Groq({ apiKey: groqApiKey });
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extract tasks from:\n${rawText}` },
        ],
        model: liveModel,
        temperature: 0.1,
      });
      const textOutput = chatCompletion.choices[0]?.message?.content || '';
      const parsed = parseJsonResponse(textOutput);
      return parsed;
    } catch (error: any) {
      if (error?.status === 404 || error?.code === 'model_not_found') {
        invalidateModelCache('groq');
      }
      console.warn('Groq extraction error, falling back to Gemini:', error);
    }
  }

  // 2. Dynamic Gemini Live Extraction with Rate-Limit & Model auto-handling
  if (geminiApiKey) {
    try {
      const liveModel = await getLiveGeminiModel(geminiApiKey);
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const response = await ai.models.generateContent({
        model: liveModel,
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nExtract tasks from:\n${rawText}` }] },
        ],
      });
      const parsed = parseJsonResponse(response.text || '');
      return parsed;
    } catch (error: any) {
      if (error?.status === 404) {
        invalidateModelCache('gemini');
      }
      console.warn('Gemini extraction error, falling back to local engine:', error);
    }
  }

  // 3. Smart Local Offline Heuristic
  return generateFallbackExtraction(rawText);
}

export async function extractTasksFromImage(
  base64Image: string,
  mimeType: string = 'image/png',
  userTimezone?: string,
  userDateISO?: string
): Promise<ExtractedCandidateTask[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  const systemPrompt = getCalendarContextPrompt(userTimezone, userDateISO);

  if (!apiKey) {
    return generateFallbackExtraction('Image upload');
  }

  try {
    const liveModel = await getLiveGeminiModel(apiKey);
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: liveModel,
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt },
            { inlineData: { data: base64Image, mimeType } },
          ],
        },
      ],
    });
    const parsed = parseJsonResponse(response.text || '');
    if (parsed.length > 0) return parsed;
  } catch (error: any) {
    if (error?.status === 404) {
      invalidateModelCache('gemini');
    }
    console.warn('Gemini image extraction error:', error);
  }

  return generateFallbackExtraction('Image task');
}

/**
 * Robust JSON parser that handles markdown code blocks, truncated brackets,
 * and embedded single/multiple task objects.
 */
function parseJsonResponse(rawOutput: string): ExtractedCandidateTask[] {
  try {
    let cleanJson = rawOutput.trim();
    
    if (cleanJson.includes('```json')) {
      cleanJson = cleanJson.split('```json')[1].split('```')[0].trim();
    } else if (cleanJson.includes('```')) {
      cleanJson = cleanJson.split('```')[1].split('```')[0].trim();
    }

    if (!cleanJson.startsWith('[')) {
      const arrayStart = cleanJson.indexOf('[');
      const arrayEnd = cleanJson.lastIndexOf(']');
      if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
        cleanJson = cleanJson.substring(arrayStart, arrayEnd + 1);
      }
    }

    // Auto-repair missing closing bracket if truncated
    if (cleanJson.startsWith('[') && !cleanJson.endsWith(']')) {
      cleanJson += ']';
    }

    const parsed = JSON.parse(cleanJson);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.tasks && Array.isArray(parsed.tasks)) return parsed.tasks;
    if (parsed.title) return [parsed];
    return [];
  } catch (err) {
    try {
      const match = rawOutput.match(/\[[\s\S]*\]/);
      if (match) return JSON.parse(match[0]);
    } catch {}
    return [];
  }
}

function generateFallbackExtraction(rawText: string): ExtractedCandidateTask[] {
  const lower = rawText.toLowerCase().trim();

  // Non-task filter: ignore greetings, questions, conversational chat, cancellation words
  const nonTaskPhrases = [
    'hi', 'hello', 'hey', 'how are you', 'how r u', 'how are u', 'cancel', 'stop', 'no', 'thanks',
    'thank you', 'ok', 'okay', 'what are you', 'who are you', 'help', 'good morning',
    'good evening', 'good afternoon', 'bye', 'goodbye', 'nothing', 'nevermind', 'sup', 'yo'
  ];
  
  if (nonTaskPhrases.some(p => lower === p || lower.startsWith(p + ' ') || lower.endsWith(' ' + p))) {
    return [];
  }
  
  if (lower.endsWith('?') && !lower.includes('remind') && !lower.includes('todo') && !lower.includes('task')) {
    return [];
  }

  // Must have action intent or date indicator
  const actionVerbs = ['do', 'buy', 'submit', 'call', 'finish', 'prepare', 'write', 'review', 'meet', 'pay', 'complete', 'fix', 'send', 'schedule', 'attend', 'clean', 'study', 'read', 'email', 'remind', 'task', 'book', 'order', 'wash', 'check'];
  const hasActionVerb = actionVerbs.some(v => new RegExp(`\\b${v}\\b`, 'i').test(lower));
  const hasDateWord = ['today', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'next week', 'by ', 'due'].some(d => lower.includes(d));

  if (!hasActionVerb && !hasDateWord && lower.split(/\s+/).length < 3) {
    return [];
  }

  const now = new Date();
  let deadlineDate: Date | null = null;
  let cleanTitle = rawText.trim();

  // Relative date parsing
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  if (lower.includes('tomorrow')) {
    deadlineDate = new Date(now);
    deadlineDate.setDate(now.getDate() + 1);
    cleanTitle = cleanTitle.replace(/\b(by|before|on)?\s*tomorrow\b/gi, '').trim();
  } else if (lower.includes('next week') || lower.includes('in 7 days')) {
    deadlineDate = new Date(now);
    deadlineDate.setDate(now.getDate() + 7);
  } else {
    for (let i = 0; i < 7; i++) {
      if (lower.includes(dayNames[i])) {
        deadlineDate = new Date(now);
        const currentDay = now.getDay();
        let diff = (i - currentDay + 7) % 7;
        if (diff === 0) diff = 7;
        deadlineDate.setDate(now.getDate() + diff);
        break;
      }
    }
  }

  let importance = 3;
  if (lower.includes('urgent') || lower.includes('asap') || lower.includes('critical') || lower.includes('emergency')) {
    importance = 5;
  } else if (lower.includes('important') || lower.includes('high priority')) {
    importance = 4;
  }

  let taskType = 'WORK';
  if (lower.includes('project') || lower.includes('build') || lower.includes('code') || lower.includes('design')) {
    taskType = 'PROJECT';
  } else if (lower.includes('pay') || lower.includes('bill') || lower.includes('fee') || lower.includes('tax') || lower.includes('money')) {
    taskType = 'FINANCE';
  } else if (lower.includes('buy') || lower.includes('grocer') || lower.includes('shop') || lower.includes('clean')) {
    taskType = 'ERRAND';
  } else if (lower.includes('gym') || lower.includes('doctor') || lower.includes('health') || lower.includes('workout')) {
    taskType = 'HEALTH';
  } else if (lower.includes('homework') || lower.includes('assignment') || lower.includes('study') || lower.includes('exam')) {
    taskType = 'ASSIGNMENT';
  }

  return [
    {
      title: cleanTitle.length > 80 ? cleanTitle.substring(0, 77) + '...' : cleanTitle,
      description: `Extracted from "${rawText.trim()}"`,
      taskType,
      deadlineISO: deadlineDate ? deadlineDate.toISOString().split('T')[0] : null,
      isDeadlineAmbiguous: !deadlineDate,
      estimatedEffortMins: 30,
      importance,
      confidenceScore: 0.8,
      subtasks: [],
    },
  ];
}
