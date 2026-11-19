import { NextRequest, NextResponse } from 'next/server';
import { isAuthEnabled, isRequestAuthorized } from '@/lib/auth';
import { db } from '@/lib/db';
import { corsHeaders, handleOptions } from '@/lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(request: NextRequest) {
  const authEnabled = isAuthEnabled();
  const authenticated = isRequestAuthorized(request);

  let dbStatus = 'ok';
  let dbError: string | null = null;
  let foldersCount = 0;

  try {
    const folders = await db.getFolders();
    foldersCount = folders.length;
  } catch (err: any) {
    dbStatus = 'error';
    dbError = err.message || 'Database error';
  }

  return NextResponse.json(
    {
      success: true,
      service: 'PocketBox Cloud API',
      authEnabled,
      authenticated,
      database: {
        type: process.env.TURSO_DATABASE_URL ? 'turso_cloud' : 'local_sqlite',
        status: dbStatus,
        error: dbError,
        foldersCount,
      },
    },
    { headers: corsHeaders() }
  );
}
