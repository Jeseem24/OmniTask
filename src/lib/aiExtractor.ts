import { GoogleGenAI } from '@google/genai';
import { Groq } from 'groq-sdk';

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

// Dynamically generate calendar context prompt on EVERY request to ensure date accuracy
const getCalendarContextPrompt = () => {
  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = dayNames[now.getDay()];
  const todayISO = now.toISOString().split('T')[0];

  const datesList = [];
  for (let i = 0; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const dayName = dayNames[d.getDay()];
    const iso = d.toISOString().split('T')[0];
    datesList.push(`- ${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dayName}: ${dayName}, ${iso}`);
  }

  return `
You are an intelligent personal task extraction engine.
Analyze the user's input (text, WhatsApp message, work email, invoice/bill screenshot, PDF, or note).

CALENDAR REFERENCE FOR RELATIVE DATES:
- Current Reference Date: ${todayISO} (${todayName})
Upcoming days calendar:
${datesList.join('\n')}

RULES:
1. ATOMIC TASK SPLITTING (CRITICAL):
   - ALWAYS split items connected by '+', '&', 'and', commas (','), or list breaks into SEPARATE INDIVIDUAL TASKS!
   - DO NOT create combined titles like "Communication + Coding + Aptitude". Instead, extract 3 separate tasks: "Placement Cell - Communication Task", "Placement Cell - Coding Task", "Placement Cell - Aptitude Task".
   - DO NOT combine "Assignment 1 & 2 + Lab experiment". Extract 3 separate tasks: "Assignment 1", "Assignment 2", and "Lab experiment / write-up".

2. HEADER & SECTION INHERITANCE:
   - Inherit date sections (e.g. "🔴 Due Today" => set deadlineISO to TODAY; "🟡 Due Monday" => set deadlineISO to coming Monday).
   - Inherit teacher / section headings (e.g., "Placement Cell", "Monisha Ma’am", "Security Lab", "Agnes Ma’am") into each task's title or subjectName!

3. DO NOT create subtasks. Always set "subtasks": [].
4. For relative dates like "this Friday", "tomorrow", "this Sunday", use the CALENDAR REFERENCE table above to pick the EXACT ISO date (YYYY-MM-DD).
5. ALWAYS provide a clear, helpful "description" string summarizing key context or notes. Never leave description empty.

Output MUST be a strictly valid JSON array matching this TypeScript structure:
[
  {
    "title": "string (clear, concise title)",
    "description": "string (detailed summary of context/instructions)",
    "subjectName": "string or null",
    "taskType": "WORK|PROJECT|FINANCE|HEALTH|ERRAND|ASSIGNMENT|PERSONAL",
    "deadlineISO": "YYYY-MM-DD or ISO-8601 string or null",
    "isDeadlineAmbiguous": boolean,
    "deadlineReasoning": "string",
    "estimatedEffortMins": 30,
    "importance": 3,
    "subtasks": [],
    "confidenceScore": 1.0
  }
]
Return ONLY the raw JSON array wrapped inside \`\`\`json ... \`\`\`.
`;
};

export async function extractTasksFromText(rawText: string): Promise<ExtractedCandidateTask[]> {
  const groqApiKey = process.env.GROQ_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const systemPrompt = getCalendarContextPrompt();

  // 1. Try Groq API first for ultra-fast text processing if available
  if (groqApiKey) {
    try {
      const groq = new Groq({ apiKey: groqApiKey });
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `USER INPUT:\n${rawText}` },
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
      });

      const textOutput = chatCompletion.choices[0]?.message?.content || '';
      return parseJsonResponse(textOutput);
    } catch (error) {
      console.error('Error calling Groq API for text extraction, falling back to Gemini:', error);
    }
  }

  // 2. Try Gemini API if available
  if (geminiApiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nUSER INPUT:\n${rawText}` }] },
        ],
      });

      const textOutput = response.text || '';
      return parseJsonResponse(textOutput);
    } catch (error) {
      console.error('Error calling Gemini API for text extraction:', error);
    }
  }

  console.warn('Neither GROQ_API_KEY nor GEMINI_API_KEY is set. Returning fallback extraction.');
  return generateFallbackExtraction(rawText);
}

export async function extractTasksFromImage(
  base64Image: string,
  mimeType: string = 'image/png'
): Promise<ExtractedCandidateTask[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  const systemPrompt = getCalendarContextPrompt();

  if (!apiKey) {
    console.warn('GEMINI_API_KEY is not set. Returning basic fallback extraction.');
    return generateFallbackExtraction('Screenshot/Image Uploaded');
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt },
            {
              inlineData: {
                data: base64Image,
                mimeType,
              },
            },
          ],
        },
      ],
    });

    const textOutput = response.text || '';
    return parseJsonResponse(textOutput);
  } catch (error) {
    console.error('Error calling Gemini API for image extraction:', error);
    return generateFallbackExtraction('Screenshot OCR Task');
  }
}

function parseJsonResponse(rawOutput: string): ExtractedCandidateTask[] {
  try {
    let cleanJson = rawOutput.trim();
    if (cleanJson.includes('```json')) {
      cleanJson = cleanJson.split('```json')[1].split('```')[0].trim();
    } else if (cleanJson.includes('```')) {
      cleanJson = cleanJson.split('```')[1].split('```')[0].trim();
    }

    const parsed = JSON.parse(cleanJson);
    if (Array.isArray(parsed)) {
      return parsed;
    } else if (parsed.tasks && Array.isArray(parsed.tasks)) {
      return parsed.tasks;
    }
    return [parsed];
  } catch (err) {
    console.error('Failed to parse JSON response from Gemini:', err, rawOutput);
    return generateFallbackExtraction('Extracted Work Item');
  }
}

function generateFallbackExtraction(promptSummary: string): ExtractedCandidateTask[] {
  const now = new Date();
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + ((7 - now.getDay()) % 7 || 7));
  nextSunday.setHours(23, 59, 0, 0);

  return [
    {
      title: promptSummary.slice(0, 60) || 'New Academic Task',
      description: promptSummary.length > 60 ? promptSummary : 'Extracted task details',
      taskType: 'ASSIGNMENT',
      deadlineISO: nextSunday.toISOString(),
      isDeadlineAmbiguous: true,
      deadlineReasoning: 'Default fallback deadline set to upcoming Sunday',
      estimatedEffortMins: 45,
      importance: 3,
      confidenceScore: 0.7,
      subtasks: [], // Explicitly no subtasks
    },
  ];
}
