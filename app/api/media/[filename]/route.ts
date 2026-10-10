import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { errorCode, logEvent } from '@/lib/observability';

export const runtime = 'nodejs';
const uploadDir = path.resolve(process.env.BARBERLAB_DATA_DIR || path.join(process.cwd(), 'data'), 'uploads');
export async function GET(_request: NextRequest, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  if (!/^[a-f0-9-]{36}\.webp$/i.test(filename)) return new NextResponse('Не знайдено', { status: 404 });
  try {
    const data = await readFile(path.join(uploadDir, filename));
    return new NextResponse(new Uint8Array(data), { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return new NextResponse('Не знайдено', { status: 404 });
    logEvent('error', 'media.read_failed', { code: errorCode(error) });
    return new NextResponse('Сховище тимчасово недоступне', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
