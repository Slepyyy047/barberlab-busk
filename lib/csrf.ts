import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { getSession, SESSION_COOKIE } from './auth';

const TOKEN_HEADER = 'x-csrf-token';
const TOKEN_LABEL = 'barberlab-admin-csrf-v1';

function deriveToken(sessionCookie: string): string {
  return createHmac('sha256', sessionCookie).update(TOKEN_LABEL).digest('base64url');
}

export function getSessionCsrfToken(request: NextRequest): string | null {
  if (!getSession(request)) return null;
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  return cookie ? deriveToken(cookie) : null;
}

export function hasValidCsrfToken(request: NextRequest): boolean {
  const expected = getSessionCsrfToken(request);
  const supplied = request.headers.get(TOKEN_HEADER);
  if (!expected || !supplied || !/^[A-Za-z0-9_-]{43}$/.test(supplied)) return false;
  const expectedBytes = Buffer.from(expected, 'base64url');
  const suppliedBytes = Buffer.from(supplied, 'base64url');
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}
