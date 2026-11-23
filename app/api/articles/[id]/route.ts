import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { corsHeaders, handleOptions } from '@/lib/cors';
import { isRequestAuthorized } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(
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
    const article = await db.getArticleById(id);

    if (!article) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    return NextResponse.json(
      { success: true, article },
      { headers: corsHeaders() }
    );
  } catch (error: any) {
    console.error('Error getting article:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve article' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function PATCH(
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
    const body = await request.json();

    const existing = await db.getArticleById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    if (body.tags !== undefined && !Array.isArray(body.tags)) {
      return NextResponse.json(
        { success: false, error: 'Tags must be an array of strings' },
        { status: 400, headers: corsHeaders() }
      );
    }

    if (body.folder_id !== undefined) {
      if (body.folder_id !== null && typeof body.folder_id !== 'string') {
        return NextResponse.json(
          { success: false, error: 'folder_id must be a string or null' },
          { status: 400, headers: corsHeaders() }
        );
      }

      const normalizedFolderId =
        typeof body.folder_id === 'string' && body.folder_id.trim() !== ''
          ? body.folder_id.trim()
          : null;

      if (normalizedFolderId !== null) {
        const folder = await db.getFolderById(normalizedFolderId);
        if (!folder) {
          return NextResponse.json(
            { success: false, error: 'Folder not found' },
            { status: 404, headers: corsHeaders() }
          );
        }
      }

      body.folder_id = normalizedFolderId;
    }

    const updated = await db.updateArticle(id, body);

    if (
      body.folder_id !== undefined &&
      body.folder_id !== null &&
      (existing.source_type === 'newsletter' || updated?.source_type === 'newsletter')
    ) {
      await db.learnNewsletterFolderFromArticle(updated || existing, body.folder_id);
    }

    return NextResponse.json(
      { success: true, article: updated },
      { headers: corsHeaders() }
    );
  } catch (error: any) {
    console.error('Error updating article:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update article' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function DELETE(
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
    await db.deleteArticle(id);

    return NextResponse.json(
      { success: true, message: 'Article deleted' },
      { headers: corsHeaders() }
    );
  } catch (error: any) {
    console.error('Error deleting article:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete article' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
