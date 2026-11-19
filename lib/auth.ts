import { NextRequest } from 'next/server';
import crypto from 'node:crypto';

export function getAuthConfig() {
  const password = (process.env.POCKETBOX_PASSWORD || '').trim();
  const apiKey = (process.env.POCKETBOX_API_KEY || '').trim();
  const isEnabled = Boolean(password || apiKey);
  return { password, apiKey, isEnabled };
}

export function isAuthEnabled(): boolean {
  return getAuthConfig().isEnabled;
}

export function getExpectedSessionToken(): string {
  const { password, apiKey } = getAuthConfig();
  const secret = password || apiKey;
  if (!secret) return '';
  return crypto.createHash('sha256').update(`${secret}_pocketbox_v1_session`).digest('hex');
}

export function verifyPassword(input: string): boolean {
  const { password, apiKey } = getAuthConfig();
  const cleanInput = (input || '').replace(/^<|>$/g, '').trim();
  if (!password && apiKey) {
    return cleanInput === apiKey;
  }
  return cleanInput === password || (Boolean(apiKey) && cleanInput === apiKey);
}

export function isRequestAuthorized(request: NextRequest): boolean {
  const { password, apiKey, isEnabled } = getAuthConfig();
  if (!isEnabled) return true;

  // 1. Check query parameter: ?token=, ?key=, ?apiKey=
  try {
    const url = new URL(request.url);
    const qToken = (url.searchParams.get('token') || url.searchParams.get('key') || url.searchParams.get('apiKey') || '').trim();
    if (qToken) {
      const cleanQ = qToken.replace(/^<|>$/g, '');
      if (apiKey && cleanQ === apiKey) return true;
      if (password && cleanQ === password) return true;
    }
  } catch {}

  // 2. Check Authorization header (flexible: "Bearer token", "Bearer <token>", or raw "token")
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const cleanHeader = authHeader.replace(/^Bearer\s+/i, '').replace(/^<|>$/g, '').trim();
    if (apiKey && cleanHeader === apiKey) return true;
    if (password && cleanHeader === password) return true;
  }

  // 3. Check X-API-Key header
  const xApiKey = request.headers.get('x-api-key');
  if (xApiKey) {
    const cleanKey = xApiKey.replace(/^<|>$/g, '').trim();
    if (apiKey && cleanKey === apiKey) return true;
    if (password && cleanKey === password) return true;
  }

  // 4. Check Session cookie
  const cookieVal = request.cookies.get('pocketbox_session')?.value;
  if (cookieVal && cookieVal === getExpectedSessionToken()) {
    return true;
  }

  return false;
}
