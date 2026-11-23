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
    const existing = await db.getFolderById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Folder not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    const body = await request.json();
    const updates: Partial<{ name: string; color: string; folder_type: FolderType }> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return NextResponse.json(
          { success: false, error: 'Folder name is required' },
          { status: 400, headers: corsHeaders() }
        );
      }
      updates.name = body.name.trim();
    }

    if (typeof body.color === 'string' && body.color.trim()) {
      updates.color = body.color.trim();
    }

    if (body.folder_type === 'newsletter' || body.folder_type === 'article') {
      updates.folder_type = body.folder_type;
    }

    const folder = await db.updateFolder(id, updates);
    return NextResponse.json({ success: true, folder }, { headers: corsHeaders() });
  } catch (error: any) {
    const msg = String(error?.message || '');
    if (msg.includes('UNIQUE') || msg.includes('SQLITE_CONSTRAINT')) {
      return NextResponse.json(
        { success: false, error: 'A folder with this name already exists' },
        { status: 409, headers: corsHeaders() }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update folder' },
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
    await db.deleteFolder(id);
    return NextResponse.json({ success: true, message: 'Folder deleted' }, { headers: corsHeaders() });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete folder' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
