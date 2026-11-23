import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractArticle, extractNewsletter } from '@/lib/extractor';
import { corsHeaders, handleOptions } from '@/lib/cors';
import { isRequestAuthorized } from '@/lib/auth';
import type { ArticleFilter, ArticleSourceType } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

function extractUrl(input: any, rawBody?: any): string | null {
  if (typeof input === 'string') {
    const m = input.match(/https?:\/\/[^\s"'<>]+/);
    if (m) return m[0];
  }
  if (rawBody) {
    if (typeof rawBody === 'string') {
      const m = rawBody.match(/https?:\/\/[^\s"'<>]+/);
      if (m) return m[0];
    }
    try {
      const str = JSON.stringify(rawBody);
      const m = str.match(/https?:\/\/[^\s"'\\<>]+/);
      if (m) return m[0].replace(/\\/g, '');
    } catch {}
  }
  return null;
}

export async function GET(request: NextRequest) {
  if (!isRequestAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', authRequired: true },
      { status: 401, headers: corsHeaders() }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const filter = (searchParams.get('filter') as ArticleFilter) || 'inbox';
    const folder_id = searchParams.get('folder_id') || undefined;
    const tag_id = searchParams.get('tag_id') || undefined;
    const q = searchParams.get('q') || undefined;

    const articles = await db.getArticles({ filter, folder_id, tag_id, q });

    return NextResponse.json(
      { success: true, articles },
      { headers: corsHeaders() }
    );
  } catch (error: any) {
    console.error('Error fetching articles:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch articles' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isRequestAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', authRequired: true },
      { status: 401, headers: corsHeaders() }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    let urlParam: any = searchParams.get('url') || searchParams.get('text');
    let rawBody: any = null;
    let html: string | undefined = undefined;
    let title: string | undefined = undefined;
    let site_name: string | undefined = undefined;
    let byline: string | undefined = undefined;
    let excerpt: string | undefined = undefined;
    let source_type: ArticleSourceType = 'article';
    let folder_id: string | null = null;
    let tags: string[] = [];

    try {
      rawBody = await request.json();
      if (rawBody && typeof rawBody === 'object') {
        urlParam = rawBody.url || rawBody.URL || rawBody.link || rawBody.text || urlParam;
        html = rawBody.html;
        title = rawBody.title;
        site_name = typeof rawBody.site_name === 'string' ? rawBody.site_name : undefined;
        byline = typeof rawBody.byline === 'string' ? rawBody.byline : undefined;
        excerpt = typeof rawBody.excerpt === 'string' ? rawBody.excerpt : undefined;
        source_type = rawBody.source_type === 'newsletter' ? 'newsletter' : 'article';
        folder_id = rawBody.folder_id || null;
        tags = Array.isArray(rawBody.tags) ? rawBody.tags : [];
      } else if (typeof rawBody === 'string') {
        urlParam = rawBody;
      }
    } catch {
      try {
        const textBody = await request.text();
        if (textBody) urlParam = urlParam || textBody;
      } catch {}
    }

    const cleanUrl = extractUrl(urlParam, rawBody);

    if (!cleanUrl) {
      return NextResponse.json(
        { success: false, error: 'Valid URL is required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Check if article already exists
    const existing = await db.getArticleByUrl(cleanUrl);
    if (existing) {
      const updates: any = {};
      if (folder_id) updates.folder_id = folder_id;
      if (tags.length > 0) updates.tags = tags;
      if (existing.is_archived) updates.is_archived = 0;
      if (source_type === 'newsletter' && existing.source_type !== 'newsletter') {
        updates.source_type = 'newsletter';
      }

      // If existing entry had fallback/placeholder content or is a newsletter re-saved with full HTML:
      const shouldReExtract =
        Boolean(html) &&
        (source_type === 'newsletter' ||
          existing.content_html?.includes('Unable to extract full content') ||
          !existing.content_html);

      if (shouldReExtract && html) {
        const reExtracted =
          source_type === 'newsletter'
            ? await extractNewsletter(cleanUrl, {
                html,
                title: title || existing.title,
                siteName: site_name || existing.site_name || undefined,
                byline: byline || existing.byline || undefined,
                excerpt,
              })
            : await extractArticle(cleanUrl, { html, fallbackTitle: title || existing.title });

        // For newsletters, update content when existing was empty/fallback or new capture is at least as complete
        const existingLen = existing.text_content?.length || 0;
        if (
          source_type !== 'newsletter' ||
          existingLen === 0 ||
          reExtracted.text_content.length >= existingLen * 0.9
        ) {
          updates.title = reExtracted.title;
          updates.byline = reExtracted.byline;
          updates.excerpt = reExtracted.excerpt;
          updates.content_html = reExtracted.content_html;
          updates.text_content = reExtracted.text_content;
          updates.site_name = reExtracted.site_name;
          updates.lead_image_url = reExtracted.lead_image_url;
          updates.reading_time_minutes = reExtracted.reading_time_minutes;
        }
      }

      const updated = Object.keys(updates).length > 0 ? await db.updateArticle(existing.id, updates) : existing;
      return NextResponse.json(
        { success: true, article: updated, alreadyExists: true },
        { headers: corsHeaders() }
      );
    }

    // Extract article or newsletter content (from provided client HTML or server fetch)
    const extracted =
      source_type === 'newsletter' && html
        ? await extractNewsletter(cleanUrl, {
            html,
            title,
            siteName: site_name,
            byline,
            excerpt,
          })
        : await extractArticle(cleanUrl, { html, fallbackTitle: title });

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
      source_type,
      folder_id: folder_id || null,
      tags: tags,
    });

    return NextResponse.json(
      { success: true, article },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error: any) {
    console.error('Error saving article:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to extract or save article' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
