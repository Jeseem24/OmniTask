import { NextResponse } from 'next/server';
import { processUserChatMessage } from '@/lib/chatEngine';
import { ensureDbInitialized } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    await ensureDbInitialized();
    const contentType = req.headers.get('content-type') || '';

    let userText = '';
    let attachments: { buffer: Buffer; mimeType: string; name: string }[] = [];
    let history: { role: 'user' | 'assistant'; content: string }[] = [];
    let userTimezone = '';
    let userDateISO = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      userText = (formData.get('message') as string) || '';
      userTimezone = (formData.get('userTimezone') as string) || '';
      userDateISO = (formData.get('userDateISO') as string) || '';
      const historyJson = formData.get('history') as string | null;
      if (historyJson) {
        try { history = JSON.parse(historyJson); } catch (e) {}
      }

      const files = formData.getAll('file') as File[];
      for (const file of files) {
        if (file && typeof file.arrayBuffer === 'function') {
          const bytes = await file.arrayBuffer();
          attachments.push({
            buffer: Buffer.from(bytes),
            mimeType: file.type,
            name: file.name,
          });
        }
      }
    } else {
      const body = await req.json();
      userText = body.message || '';
      userTimezone = body.userTimezone || '';
      userDateISO = body.userDateISO || '';
      if (Array.isArray(body.history)) {
        history = body.history;
      }
    }

    if (!userText.trim() && attachments.length === 0) {
      return NextResponse.json({ error: 'Please enter a message or attach a file.' }, { status: 400 });
    }

    const replyPayload = await processUserChatMessage(
      userText,
      attachments.length > 0 ? attachments[0].buffer : null,
      attachments.length > 0 ? attachments[0].mimeType : null,
      attachments.length > 0 ? attachments[0].name : null,
      history,
      attachments,
      userTimezone,
      userDateISO
    );

    return NextResponse.json(replyPayload);
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: 'Failed to process chat message' }, { status: 500 });
  }
}
