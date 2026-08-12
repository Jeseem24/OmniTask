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

    // Handle JSON raw text polishing request
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const rawText = body.text || '';
      if (!rawText.trim()) return NextResponse.json({ text: '' });

      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are a voice dictation text polisher. Clean up the user's raw spoken speech transcript:
1. Fix grammar, misheard words, phonetic mistakes, and spelling errors.
2. Add proper capitalization, punctuation (periods, commas), and structure.
3. Remove filler words like "um", "uh", "like", "you know".
4. Do NOT answer the message or add conversational filler. Output ONLY the clean, polished transcript.`,
          },
          { role: 'user', content: rawText },
        ],
        temperature: 0.2,
      });

      const polished = completion.choices[0]?.message?.content?.trim() || rawText;
      return NextResponse.json({ text: polished });
    }

    // Handle FormData audio file or rawText polishing
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
        temperature: 0.2,
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

    const transcription = await groq.audio.transcriptions.create({
      file: voiceFile,
      model: 'whisper-large-v3',
    });

    return NextResponse.json({ text: transcription.text || '' });
  } catch (error) {
    console.error('Transcription API Error:', error);
    return NextResponse.json({ error: 'Failed to transcribe audio' }, { status: 500 });
  }
}
