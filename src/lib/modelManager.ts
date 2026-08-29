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
 * Dynamically queries Gemini API for currently active models from Google's live model registry,
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
    const liveModels: string[] = [];

    // Query Google's live model registry dynamically
    const modelIterator = await ai.models.list();
    for await (const m of modelIterator) {
      if (m.name) {
        const cleanName = m.name.replace(/^models\//, '');
        // Only include multimodal text & vision generation models (exclude tts/audio/imagegen/embedding only)
        if (
          cleanName.includes('flash') ||
          cleanName.includes('pro') ||
          cleanName.includes('gemini')
        ) {
          if (!cleanName.includes('tts') && !cleanName.includes('embedding') && !cleanName.includes('veo') && !cleanName.includes('lyria')) {
            liveModels.push(cleanName);
          }
        }
      }
    }

    // Capability hierarchy for Gemini: prefer newest generation flash, then pro
    const preferenceRules = [
      (id: string) => id === 'gemini-3.7-flash',
      (id: string) => id === 'gemini-3.6-flash',
      (id: string) => id === 'gemini-3.5-flash',
      (id: string) => id.includes('3.6') && id.includes('flash'),
      (id: string) => id.includes('3.5') && id.includes('flash'),
      (id: string) => id === 'gemini-flash-latest',
      (id: string) => id.includes('3') && id.includes('flash'),
      (id: string) => id.includes('pro-latest') || id.includes('3.5-pro'),
    ];

    for (const rule of preferenceRules) {
      const match = liveModels.find(rule);
      if (match) {
        cachedGeminiModel = { model: match, lastChecked: Date.now() };
        console.log(`[Auto-Model] Discovered and selected live Gemini model: ${match}`);
        return match;
      }
    }

    if (liveModels.length > 0) {
      cachedGeminiModel = { model: liveModels[0], lastChecked: Date.now() };
      return liveModels[0];
    }
  } catch (err) {
    console.warn('[Auto-Model] Error discovering live Gemini models, using fallback:', err);
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
