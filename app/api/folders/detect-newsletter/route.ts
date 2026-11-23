import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { corsHeaders, handleOptions } from '@/lib/cors';
import { isRequestAuthorized } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(request: NextRequest) {
  if (!isRequestAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', authRequired: true },
      { status: 401, headers: corsHeaders() }
    );
  }

  try {
    const body = await request.json();
    const result = await db.classifyNewsletter({
      title: typeof body.title === 'string' ? body.title : null,
      siteName: typeof body.site_name === 'string' ? body.site_name : null,
      byline: typeof body.byline === 'string' ? body.byline : null,
      senderEmail: typeof body.sender_email === 'string' ? body.sender_email : null,
      senderName: typeof body.sender_name === 'string' ? body.sender_name : null,
      url: typeof body.url === 'string' ? body.url : null,
      html: typeof body.html === 'string' ? body.html : null,
    });

    return NextResponse.json(
      {
        success: true,
        ...result,
      },
      { headers: corsHeaders() }
    );
  } catch (error: any) {
    console.error('[detect-newsletter] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to classify newsletter' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
