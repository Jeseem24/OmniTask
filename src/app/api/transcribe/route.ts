import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY is not configured' }, { status: 500 });
    }

    const { Groq } = require('groq-sdk');
    const groq = new Groq({ apiKey: groqApiKey });

    const contentType = req.headers.get('content-type') || '';

    // 1. Handle JSON text polishing
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const rawText = body.text || '';
      if (!rawText.trim()) return NextResponse.json({ text: '' });

      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are a professional voice dictation text polisher. Clean up the user's raw spoken transcript:
1. Fix grammar, misheard words, phonetic mistakes, and spelling errors.
2. Add proper capitalization, punctuation (periods, commas), and structure.
3. Remove filler words like "um", "uh", "like", "you know".
4. Output ONLY the clean, polished transcript. No preamble, no quotes.`,
          },
          { role: 'user', content: rawText },
        ],
        temperature: 0.1,
      });

      const polished = completion.choices[0]?.message?.content?.trim() || rawText;
      return NextResponse.json({ text: polished });
    }

    // 2. Handle Audio File Transcription via Whisper Large v3 + Llama 3.3 Polish
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const rawText = formData.get('rawText') as string | null;

    if (rawText && rawText.trim()) {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `Clean up raw voice dictation speech: fix spelling, grammar, add proper punctuation. Remove filler words like 'um'/'uh'. Return ONLY the polished text without quotes or explanations.`,
          },
          { role: 'user', content: rawText },
        ],
        temperature: 0.1,
      });
      const polished = completion.choices[0]?.message?.content?.trim() || rawText;
      return NextResponse.json({ text: polished });
    }

    if (!file) {
      return NextResponse.json({ error: 'No file or text provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const uint8Array = new Uint8Array(bytes);
    const voiceFile = new File([uint8Array], file.name || 'recording.webm', { type: file.type || 'audio/webm' });

    // Step A: Whisper Large v3 Precision Audio Transcription with Prompt Context
    const transcription = await groq.audio.transcriptions.create({
      file: voiceFile,
      model: 'whisper-large-v3',
      prompt: 'OmniTask voice dictation for tasks, reminders, categories, priorities, due dates, meetings, study notes, and responsibilities.',
      temperature: 0.0,
      language: 'en',
    });

    let cleanText = transcription.text || '';

    // Step B: Llama 3.3 70B Formatting Pass (Adds punctuation, fixes capitalization & line breaks)
    if (cleanText.trim()) {
      try {
        const completion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: `You are a voice transcript formatting expert. Format the user's speech transcript:
1. Correct any slight homophones or phonetic mishearing.
2. Add capitalization, periods, commas, and line breaks for multiple tasks or items.
3. Remove filler words ("um", "uh", "like", "you know").
4. Output ONLY the clean, polished text. No quotes, no preamble.`,
            },
            { role: 'user', content: cleanText },
          ],
          temperature: 0.1,
        });
        const formatted = completion.choices[0]?.message?.content?.trim();
        if (formatted) cleanText = formatted;
      } catch (e) {
        console.error('Llama formatting pass note:', e);
      }
    }

    return NextResponse.json({ text: cleanText });
  } catch (error) {
    console.error('Transcription API Error:', error);
    return NextResponse.json({ error: 'Failed to transcribe audio' }, { status: 500 });
  }
}
