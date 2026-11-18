import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { corsHeaders, handleOptions } from '@/lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    db.deleteFolder(id);
    return NextResponse.json({ success: true, message: 'Folder deleted' }, { headers: corsHeaders() });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete folder' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
