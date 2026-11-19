import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractArticle } from '@/lib/extractor';
import { corsHeaders, handleOptions } from '@/lib/cors';
import { isRequestAuthorized } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

function extractUrl(input: any): string | null {
  if (!input) return null;
  if (typeof input === 'string') {
    const m = input.match(/https?:\/\/[^\s"'<>]+/);
    return m ? m[0] : null;
  }
  try {
    const str = JSON.stringify(input);
    const m = str.match(/https?:\/\/[^\s"'\\<>]+/);
    return m ? m[0].replace(/\\/g, '') : null;
  } catch {
    return null;
  }
}

async function handleSave(request: NextRequest, targetUrlRaw: any) {
  if (!isRequestAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: missing or invalid password/key' },
      { status: 401, headers: corsHeaders() }
    );
  }

  const cleanUrl = extractUrl(targetUrlRaw);
  if (!cleanUrl) {
    return NextResponse.json(
      { success: false, error: 'Valid URL is required' },
      { status: 400, headers: corsHeaders() }
    );
  }

  try {
    // Check if article already exists
    const existing = await db.getArticleByUrl(cleanUrl);
    if (existing) {
      if (existing.is_archived) {
        await db.updateArticle(existing.id, { is_archived: 0 });
      }
      return NextResponse.json(
        { success: true, message: 'Article already in library (unarchived)', title: existing.title, article: existing },
        { headers: corsHeaders() }
      );
    }

    // Extract article content
    const extracted = await extractArticle(cleanUrl);

    // Persist to Database
    const article = await db.createArticle({
      url: extracted.url,
      title: extracted.title,
      byline: extracted.byline,
      excerpt: extracted.excerpt,
      content_html: extracted.content_html,
      text_content: extracted.text_content,
      site_name: extracted.site_name,
      lead_image_url: extracted.lead_image_url,
      reading_time_minutes: extracted.reading_time_minutes,
      folder_id: null,
      tags: [],
    });

    return NextResponse.json(
      { success: true, message: 'Article saved successfully', title: article.title, article },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error: any) {
    console.error('[API/Save] Error saving article:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to extract or save article' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const urlParam = searchParams.get('url') || searchParams.get('text') || searchParams.get('link');
  return handleSave(request, urlParam);
}

export async function POST(request: NextRequest) {
  let urlCandidate: any = null;
  const { searchParams } = new URL(request.url);
  urlCandidate = searchParams.get('url') || searchParams.get('text');

  if (!urlCandidate) {
    try {
      const body = await request.json();
      urlCandidate = body?.url || body?.URL || body?.link || body?.text || body;
    } catch {
      try {
        urlCandidate = await request.text();
      } catch {}
    }
  }

  return handleSave(request, urlCandidate);
}
