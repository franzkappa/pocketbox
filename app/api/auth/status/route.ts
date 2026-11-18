import { NextRequest, NextResponse } from 'next/server';
import { isAuthEnabled, isRequestAuthorized } from '@/lib/auth';
import { corsHeaders, handleOptions } from '@/lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(request: NextRequest) {
  const authEnabled = isAuthEnabled();
  const authenticated = isRequestAuthorized(request);

  return NextResponse.json(
    {
      success: true,
      authEnabled,
      authenticated,
    },
    { headers: corsHeaders() }
  );
}
