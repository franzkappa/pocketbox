import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { corsHeaders, handleOptions } from '@/lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET() {
  try {
    const folders = db.getFolders();
    return NextResponse.json({ success: true, folders }, { headers: corsHeaders() });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list folders' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, color } = body;
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Folder name is required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const folder = db.createFolder(name, color || '#6366F1');
    return NextResponse.json({ success: true, folder }, { status: 201, headers: corsHeaders() });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create folder' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
