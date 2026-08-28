import { Groq } from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';

interface CachedModel {
  model: string;
  lastChecked: number;
}

let cachedGroqModel: CachedModel | null = null;
let cachedGeminiModel: CachedModel | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Dynamically queries Groq API for currently active models,
 * ranking by model capability and selecting the best live model.
 */
export async function getLiveGroqModel(apiKey?: string): Promise<string> {
  const key = apiKey || process.env.GROQ_API_KEY;
  if (!key) return 'openai/gpt-oss-120b';

  // Return cached live model if still fresh
  if (cachedGroqModel && Date.now() - cachedGroqModel.lastChecked < CACHE_TTL_MS) {
    return cachedGroqModel.model;
  }

  try {
    const groq = new Groq({ apiKey: key });
    const modelList = await groq.models.list();
    const activeModelIds = modelList.data
      .filter((m: any) => !m.id.includes('whisper') && !m.id.includes('guard') && !m.id.includes('tts'))
      .map((m: any) => m.id as string);

    // Capability hierarchy: prefer large reasoning models, then fast instruction models
    const preferenceRules = [
      (id: string) => id.includes('120b') || id.includes('gpt-oss-120b'),
      (id: string) => id.includes('70b') || id.includes('qwen3.8') || id.includes('qwen3'),
      (id: string) => id.includes('compound') && !id.includes('mini'),
      (id: string) => id.includes('27b') || id.includes('20b'),
      (id: string) => id.includes('llama-3') || id.includes('llama3'),
      (id: string) => id.includes('gemma') || id.includes('mixtral'),
    ];

    for (const rule of preferenceRules) {
      const match = activeModelIds.find(rule);
      if (match) {
        cachedGroqModel = { model: match, lastChecked: Date.now() };
        console.log(`[Auto-Model] Selected live Groq model: ${match}`);
        return match;
      }
    }

    if (activeModelIds.length > 0) {
      cachedGroqModel = { model: activeModelIds[0], lastChecked: Date.now() };
      return activeModelIds[0];
    }
  } catch (err) {
    console.warn('[Auto-Model] Error discovering Groq models, using fallback:', err);
  }

  return 'openai/gpt-oss-120b';
}

/**
 * Dynamically queries Gemini API for currently active models,
 * selecting the latest working flash/pro model.
 */
export async function getLiveGeminiModel(apiKey?: string): Promise<string> {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) return 'gemini-3.6-flash';

  if (cachedGeminiModel && Date.now() - cachedGeminiModel.lastChecked < CACHE_TTL_MS) {
    return cachedGeminiModel.model;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    // Known priority candidates in order of preference
    const candidates = [
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest',
      'gemini-3.5-flash-lite',
      'gemini-3-flash-preview',
    ];

    for (const candidate of candidates) {
      try {
        await ai.models.generateContent({
          model: candidate,
          contents: 'ping',
        });
        cachedGeminiModel = { model: candidate, lastChecked: Date.now() };
        console.log(`[Auto-Model] Selected live Gemini model: ${candidate}`);
        return candidate;
      } catch (err: any) {
        if (err?.status === 404 || err?.message?.includes('not found') || err?.message?.includes('deprecated')) {
          continue; // Try next candidate
        }
        // If it's a rate limit or other error, model exists
        cachedGeminiModel = { model: candidate, lastChecked: Date.now() };
        return candidate;
      }
    }
  } catch (err) {
    console.warn('[Auto-Model] Error discovering Gemini models, using fallback:', err);
  }

  return 'gemini-3.6-flash';
}

/**
 * Invalidate cached model when a 404 or deprecation error occurs at runtime
 */
export function invalidateModelCache(provider: 'groq' | 'gemini') {
  if (provider === 'groq') cachedGroqModel = null;
  if (provider === 'gemini') cachedGeminiModel = null;
}
