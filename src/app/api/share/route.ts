import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const text = (formData.get('text') as string) || (formData.get('title') as string) || '';
    const file = formData.get('file') as File | null;

    const url = new URL('/', req.url);
    if (text) {
      url.searchParams.set('text', text);
    }

    return NextResponse.redirect(url, 303);
  } catch (error) {
    console.error('Share Target Error:', error);
    return NextResponse.redirect(new URL('/', req.url), 303);
  }
}
