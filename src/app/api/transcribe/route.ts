import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY is not configured' }, { status: 500 });
    }

    const { Groq } = require('groq-sdk');
    const groq = new Groq({ apiKey: groqApiKey });

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
