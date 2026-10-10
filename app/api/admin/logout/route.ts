import { NextResponse, type NextRequest } from 'next/server';
import { deleteSession, SESSION_COOKIE } from '@/lib/auth';
import { noStore, rejectCrossOrigin } from '@/lib/http';

export const runtime = 'nodejs';
export function POST(request: NextRequest) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  deleteSession(request);
  const response = NextResponse.json({ authenticated: false }, { headers: noStore });
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'strict', secure: request.nextUrl.protocol === 'https:', path: '/', maxAge: 0 });
  return response;
}
