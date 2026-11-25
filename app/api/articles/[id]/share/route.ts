import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { corsHeaders, handleOptions } from '@/lib/cors';
import { isRequestAuthorized } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isRequestAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', authRequired: true },
      { status: 401, headers: corsHeaders() }
    );
  }

  try {
    const { id } = await params;
    const shareToken = await db.createOrGetShareToken(id);

    if (!shareToken) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    return NextResponse.json(
      {
        success: true,
        share_token: shareToken,
        share_path: `/share/${shareToken}`,
      },
      { headers: corsHeaders() }
    );
  } catch (error: any) {
    console.error('Error generating share link:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to generate share link' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
