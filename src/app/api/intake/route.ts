import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractTasksFromText, extractTasksFromImage, ExtractedCandidateTask } from '@/lib/aiExtractor';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    
    let sourceType = 'WHATSAPP_TEXT';
    let rawContent: string | null = null;
    let filePath: string | null = null;
    let candidateTasks: ExtractedCandidateTask[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const type = (formData.get('type') as string) || 'PDF';
      sourceType = type;
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      if (file.type.includes('pdf') || type === 'PDF') {
        const pdfParse = require('pdf-parse');
        const parsedPdf = await pdfParse(buffer);
        rawContent = parsedPdf.text || `PDF file: ${file.name}`;
        candidateTasks = await extractTasksFromText(rawContent || '');
      } else if (file.type.includes('image') || type === 'SCREENSHOT') {
        const base64Image = buffer.toString('base64');
        rawContent = `Uploaded Image: ${file.name}`;
        candidateTasks = await extractTasksFromImage(base64Image, file.type || 'image/png');
      } else {
        return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
      }
    } else {
      const body = await req.json();
      sourceType = body.type || 'WHATSAPP_TEXT';
      rawContent = body.content || '';

      if (!rawContent || !rawContent.trim()) {
        return NextResponse.json({ error: 'Content cannot be empty' }, { status: 400 });
      }

      candidateTasks = await extractTasksFromText(rawContent);
    }

    // Save Source record
    const source = await prisma.source.create({
      data: {
        type: sourceType,
        rawContent: rawContent?.slice(0, 5000) || null,
        filePath: filePath || null,
      },
    });

    // Save Candidate Extraction record
    const extraction = await prisma.candidateExtraction.create({
      data: {
        sourceId: source.id,
        extractedJson: JSON.stringify(candidateTasks),
        status: 'PENDING_REVIEW',
      },
    });

    return NextResponse.json({
      extractionId: extraction.id,
      sourceId: source.id,
      candidateCount: candidateTasks.length,
      candidateTasks,
    });
  } catch (error) {
    console.error('Error processing intake:', error);
    return NextResponse.json({ error: 'Failed to process intake information' }, { status: 500 });
  }
}
