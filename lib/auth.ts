import { NextRequest } from 'next/server';
import crypto from 'node:crypto';

export function getAuthConfig() {
  const password = process.env.POCKETBOX_PASSWORD || '';
  const apiKey = process.env.POCKETBOX_API_KEY || '';
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
  if (!password && apiKey) {
    return input.trim() === apiKey.trim();
  }
  return input.trim() === password.trim();
}

export function isRequestAuthorized(request: NextRequest): boolean {
  const { password, apiKey, isEnabled } = getAuthConfig();
  if (!isEnabled) return true;

  // 1. Authorization: Bearer <key>
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (apiKey && token === apiKey.trim()) return true;
    if (password && token === password.trim()) return true;
  }

  // 2. X-API-Key: <key>
  const xApiKey = request.headers.get('x-api-key');
  if (xApiKey) {
    const token = xApiKey.trim();
    if (apiKey && token === apiKey.trim()) return true;
    if (password && token === password.trim()) return true;
  }

  // 3. Cookie session check
  const cookieVal = request.cookies.get('pocketbox_session')?.value;
  if (cookieVal && cookieVal === getExpectedSessionToken()) {
    return true;
  }

  return false;
}
