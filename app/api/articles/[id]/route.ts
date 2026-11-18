import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { corsHeaders, handleOptions } from '@/lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const article = db.getArticleById(id);

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
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = db.getArticleById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    const updated = db.updateArticle(id, body);

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
  try {
    const { id } = await params;
    db.deleteArticle(id);

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
