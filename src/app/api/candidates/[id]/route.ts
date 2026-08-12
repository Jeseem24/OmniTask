import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const extraction = await prisma.candidateExtraction.findUnique({
      where: { id },
      include: { source: true },
    });

    if (!extraction) {
      return NextResponse.json({ error: 'Candidate extraction not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...extraction,
      extractedTasks: JSON.parse(extraction.extractedJson || '[]'),
    });
  } catch (error) {
    console.error('Error fetching candidate extraction:', error);
    return NextResponse.json({ error: 'Failed to fetch candidate tasks' }, { status: 500 });
  }
}
