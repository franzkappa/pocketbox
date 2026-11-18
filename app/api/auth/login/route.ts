import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, getExpectedSessionToken } from '@/lib/auth';
import { corsHeaders, handleOptions } from '@/lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Password is required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    if (!verifyPassword(password)) {
      return NextResponse.json(
        { success: false, error: 'Password errata' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const sessionToken = getExpectedSessionToken();
    const response = NextResponse.json(
      { success: true, message: 'Autenticazione riuscita' },
      { headers: corsHeaders() }
    );

    // Set 1-year HttpOnly session cookie
    response.cookies.set({
      name: 'pocketbox_session',
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 31536000, // 1 year
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Login failed' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
