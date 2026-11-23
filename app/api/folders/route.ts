import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { corsHeaders, handleOptions } from '@/lib/cors';
import { isRequestAuthorized } from '@/lib/auth';
import type { FolderType } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
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
    const rawType = searchParams.get('type');
    const folderType: FolderType | undefined =
      rawType === 'newsletter' || rawType === 'article' ? rawType : undefined;

    const folders = await db.getFolders(folderType);
    return NextResponse.json({ success: true, folders }, { headers: corsHeaders() });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list folders' },
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
    const body = await request.json();
    const { name, color, folder_type } = body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Folder name is required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const folderType: FolderType =
      folder_type === 'newsletter' ? 'newsletter' : 'article';
    const folder = await db.createFolder(name, color || '#6366F1', folderType);
    return NextResponse.json({ success: true, folder }, { status: 201, headers: corsHeaders() });
  } catch (error: any) {
    const msg = String(error?.message || '');
    if (msg.includes('UNIQUE') || msg.includes('SQLITE_CONSTRAINT')) {
      return NextResponse.json(
        { success: false, error: 'A folder with this name already exists' },
        { status: 409, headers: corsHeaders() }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create folder' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
