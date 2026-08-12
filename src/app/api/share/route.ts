import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Temporary shared files memory store (keyed by random shareId)
const shareCache = new Map<string, { files: { name: string; type: string; data: string }[]; text: string }>();

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    let text = (formData.get('text') as string) || '';
    let title = (formData.get('title') as string) || '';

    // Ignore generic WhatsApp share captions like "Photo from Jeseem" or "Document from Jeseem"
    if (text.startsWith('Photo from') || text.startsWith('Document from')) text = '';
    if (title.startsWith('Photo from') || title.startsWith('Document from')) title = '';

    const combinedText = text || title;

    // Collect all uploaded files from form data
    const rawFiles = [...formData.getAll('file'), ...formData.getAll('files'), ...formData.getAll('media')];
    const fileEntries: { name: string; type: string; data: string }[] = [];

    for (const item of rawFiles) {
      if (item && typeof item === 'object' && 'arrayBuffer' in item) {
        const file = item as File;
        if (file.size > 0) {
          const buffer = await file.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          fileEntries.push({
            name: file.name || 'shared-file',
            type: file.type || 'application/octet-stream',
            data: `data:${file.type || 'application/octet-stream'};base64,${base64}`,
          });
        }
      }
    }

    const shareId = `share-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    shareCache.set(shareId, { files: fileEntries, text: combinedText });

    // Clean up old cache entries after 10 minutes
    setTimeout(() => shareCache.delete(shareId), 10 * 60 * 1000);

    const url = new URL('/', req.url);
    url.searchParams.set('shareId', shareId);

    return NextResponse.redirect(url, 303);
  } catch (error) {
    console.error('Share Target Error:', error);
    return NextResponse.redirect(new URL('/', req.url), 303);
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const shareId = searchParams.get('id');

  if (!shareId || !shareCache.has(shareId)) {
    return NextResponse.json({ error: 'Shared content expired or not found' }, { status: 404 });
  }

  const data = shareCache.get(shareId);
  return NextResponse.json(data);
}
