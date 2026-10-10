import { NextResponse, type NextRequest } from 'next/server';
import { getSession, hasSameOrigin } from './auth';

export const noStore = { 'Cache-Control': 'no-store, max-age=0' };
export function rejectCrossOrigin(request: NextRequest): NextResponse | null {
  return hasSameOrigin(request) ? null : NextResponse.json({ error: 'Запит відхилено. Оновіть сторінку та спробуйте ще раз.' }, { status: 403, headers: noStore });
}
export function requireAdmin(request: NextRequest): { username: string } | NextResponse {
  const username = getSession(request);
  return username ? { username } : NextResponse.json({ error: 'Потрібно увійти до панелі керування.' }, { status: 401, headers: noStore });
}
export function isResponse(value: unknown): value is NextResponse { return value instanceof NextResponse; }
export class RequestBodyTooLargeError extends Error {
  constructor() { super('Запит завеликий.'); this.name = 'RequestBodyTooLargeError'; }
}

export async function readBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  const length = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(length) && length > maxBytes) throw new RequestBodyTooLargeError();
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

export async function readJson(request: NextRequest, maxBytes = 1_500_000): Promise<unknown> {
  const body = await readBody(request, maxBytes);
  return JSON.parse(new TextDecoder().decode(body)) as unknown;
}
