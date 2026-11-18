import { NextResponse } from 'next/server';
import { corsHeaders, handleOptions } from '@/lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST() {
  const response = NextResponse.json(
    { success: true, message: 'Logged out' },
    { headers: corsHeaders() }
  );

  response.cookies.set({
    name: 'pocketbox_session',
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
