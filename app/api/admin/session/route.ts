import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSessionCsrfToken } from '@/lib/csrf';
import { noStore } from '@/lib/http';

export const runtime = 'nodejs';
export function GET(request: NextRequest) {
  const username = getSession(request);
  const csrfToken = username ? getSessionCsrfToken(request) : null;
  return NextResponse.json(username && csrfToken ? { authenticated: true, username, csrfToken } : { authenticated: false }, { headers: noStore });
}
