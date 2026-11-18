import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractArticle } from '@/lib/extractor';
import { corsHeaders, handleOptions } from '@/lib/cors';
import type { ArticleFilter } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = (searchParams.get('filter') as ArticleFilter) || 'inbox';
    const folder_id = searchParams.get('folder_id') || undefined;
    const tag_id = searchParams.get('tag_id') || undefined;
    const q = searchParams.get('q') || undefined;

    const articles = db.getArticles({ filter, folder_id, tag_id, q });

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
  try {
    const body = await request.json();
    const { url, folder_id, tags } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Valid URL is required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Check if article already exists
    const existing = db.getArticleByUrl(url);
    if (existing) {
      // If already saved, we can unarchive it if it was archived, or update folder/tags if provided
      const updates: any = {};
      if (folder_id !== undefined) updates.folder_id = folder_id;
      if (tags !== undefined) updates.tags = tags;
      if (existing.is_archived) updates.is_archived = 0;

      const updated = Object.keys(updates).length > 0 ? db.updateArticle(existing.id, updates) : existing;
      return NextResponse.json(
        { success: true, article: updated, alreadyExists: true },
        { headers: corsHeaders() }
      );
    }

    // Extract article content
    const extracted = await extractArticle(url);

    // Persist to SQLite
    const article = db.createArticle({
      url: extracted.url,
      title: extracted.title,
      byline: extracted.byline,
      excerpt: extracted.excerpt,
      content_html: extracted.content_html,
      text_content: extracted.text_content,
      site_name: extracted.site_name,
      lead_image_url: extracted.lead_image_url,
      reading_time_minutes: extracted.reading_time_minutes,
      folder_id: folder_id || null,
      tags: Array.isArray(tags) ? tags : [],
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
