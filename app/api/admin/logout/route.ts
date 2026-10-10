import { NextResponse, type NextRequest } from 'next/server';
import { deleteSession, SESSION_COOKIE } from '@/lib/auth';
import { isResponse, noStore, rejectCrossOrigin, requireAdminMutation } from '@/lib/http';

export const runtime = 'nodejs';
export function POST(request: NextRequest) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const authorization = requireAdminMutation(request);
  if (isResponse(authorization)) return authorization;
  deleteSession(request);
  const response = NextResponse.json({ authenticated: false }, { headers: noStore });
  const secure = request.nextUrl.protocol === 'https:' || process.env.BARBERLAB_APP_ORIGIN?.startsWith('https://') === true;
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'strict', secure, path: '/', maxAge: 0 });
  return response;
}
