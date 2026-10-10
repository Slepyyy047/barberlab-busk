import { NextResponse, type NextRequest } from 'next/server';
import { checkLogin, createSession, SESSION_COOKIE } from '@/lib/auth';
import { noStore, readJson, rejectCrossOrigin, RequestBodyTooLargeError } from '@/lib/http';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  let body: unknown;
  try { body = await readJson(request, 10_000); }
  catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return NextResponse.json({ error: tooLarge ? error.message : 'Перевірте формат запиту.' }, { status: tooLarge ? 413 : 400, headers: noStore });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Перевірте ім’я та пароль.' }, { status: 400, headers: noStore });
  const values = body as Record<string, unknown>;
  if (typeof values.username !== 'string' || typeof values.password !== 'string' || values.username.length > 80 || values.password.length > 256) {
    return NextResponse.json({ error: 'Перевірте ім’я та пароль.' }, { status: 400, headers: noStore });
  }
  const result = checkLogin(values.username, values.password);
  if (!result.ok) return NextResponse.json({ error: result.limited ? 'Забагато спроб. Спробуйте через 15 хвилин.' : 'Неправильне ім’я або пароль.' }, { status: result.limited ? 429 : 401, headers: noStore });
  const session = createSession(values.username.trim());
  const response = NextResponse.json({ authenticated: true }, { headers: noStore });
  const secure = request.nextUrl.protocol === 'https:' || process.env.BARBERLAB_APP_ORIGIN?.startsWith('https://') === true;
  response.cookies.set(SESSION_COOKIE, session.token, { httpOnly: true, sameSite: 'strict', secure, path: '/', expires: new Date(session.expiresAt) });
  return response;
}
