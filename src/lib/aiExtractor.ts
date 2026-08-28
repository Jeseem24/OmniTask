import { GoogleGenAI } from '@google/genai';
import { Groq } from 'groq-sdk';
import { getLiveGroqModel, getLiveGeminiModel, invalidateModelCache } from './modelManager';

export interface ExtractedCandidateTask {
  title: string;
  description?: string;
  subjectCode?: string;
  subjectName?: string;
  taskType:
    | 'WORK'
    | 'PROJECT'
    | 'FINANCE'
    | 'HEALTH'
    | 'ERRAND'
    | 'ASSIGNMENT'
    | 'RECORD'
    | 'OBSERVATION'
    | 'SUBMISSION'
    | 'QUIZ'
    | 'EXAM'
    | 'PRESENTATION'
    | 'READING'
    | 'PRACTICE'
    | 'EVENT'
    | 'MAINTENANCE'
    | 'PERSONAL'
    | 'SOCIAL'
    | 'LEARNING'
    | 'OTHER';
  deadlineISO?: string | null;
  isDeadlineAmbiguous: boolean;
  deadlineReasoning?: string;
  estimatedEffortMins: number;
  importance: number; // 1-5
  subtasks?: {
    title: string;
    estimatedEffortMins?: number;
    taskType?: string;
  }[];
  confidenceScore: number; // 0.0 to 1.0
  userModified?: boolean;
}

export function getCalendarContextPrompt(userTimezone?: string, userDateISO?: string) {
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
4. Estimate effort in minutes (e.g. 15, 30, 45, 60).
5. Always return subtasks as [] unless explicit numbered sub-steps are listed.
6. Return a valid JSON array of objects.

EXAMPLE OUTPUT:
[
  {
    "title": "Email supervisor project selection",
    "description": "Send selection email for mini and final year projects",
    "taskType": "WORK",
    "deadlineISO": "${todayISO}",
    "isDeadlineAmbiguous": false,
    "estimatedEffortMins": 20,
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
      if (parsed.length > 0) return parsed;
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
      if (parsed.length > 0) return parsed;
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
  const now = new Date();
  const lower = rawText.toLowerCase();
  let deadlineDate: Date | null = null;
  let cleanTitle = rawText.trim();

  // Relative date parsing
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  if (lower.includes('tomorrow')) {
    deadlineDate = new Date(now);
    deadlineDate.setDate(now.getDate() + 1);
    cleanTitle = cleanTitle.replace(/\b(by|before|on)?\s*tomorrow\b/gi, '').trim();
  } else if (lower.includes('today') || lower.includes('tonight')) {
    deadlineDate = new Date(now);
    cleanTitle = cleanTitle.replace(/\b(by|before|on)?\s*(today|tonight)\b/gi, '').trim();
  } else if (lower.match(/\bin\s+(\d+)\s+days?\b/i)) {
    const days = parseInt(lower.match(/\bin\s+(\d+)\s+days?\b/i)![1], 10);
    deadlineDate = new Date(now);
    deadlineDate.setDate(now.getDate() + days);
    cleanTitle = cleanTitle.replace(/\bin\s+\d+\s+days?\b/gi, '').trim();
  } else {
    for (let targetDay = 0; targetDay < 7; targetDay++) {
      if (lower.includes(dayNames[targetDay])) {
        const curDay = now.getDay();
        let diff = (targetDay - curDay + 7) % 7;
        if (diff === 0) diff = 7;
        deadlineDate = new Date(now);
        deadlineDate.setDate(now.getDate() + diff);
        cleanTitle = cleanTitle.replace(new RegExp(`\\b(by|before|on)?\\s*${dayNames[targetDay]}\\b`, 'gi'), '').trim();
        break;
      }
    }
  }

  if (!deadlineDate) {
    deadlineDate = new Date(now);
    deadlineDate.setDate(now.getDate() + ((7 - now.getDay()) % 7 || 7));
  }

  cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
  if (cleanTitle.length > 80) cleanTitle = cleanTitle.slice(0, 80);

  return [
    {
      title: cleanTitle || 'New Task',
      description: `Extracted from "${rawText.slice(0, 100)}"`,
      taskType: 'PERSONAL',
      deadlineISO: deadlineDate.toISOString(),
      isDeadlineAmbiguous: false,
      deadlineReasoning: 'Parsed from user input',
      estimatedEffortMins: 30,
      importance: 3,
      confidenceScore: 0.9,
      subtasks: [],
    },
  ];
}
