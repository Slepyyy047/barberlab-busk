import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { NextResponse, type NextRequest } from 'next/server';
import { isResponse, noStore, readBody, readJson, rejectCrossOrigin, requireAdminMutation, RequestBodyTooLargeError } from '@/lib/http';
import { errorCode, isStorageError, logEvent } from '@/lib/observability';

export const runtime = 'nodejs';
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_MULTIPART_OVERHEAD_BYTES = 256 * 1024;
const uploadDir = path.resolve(process.env.BARBERLAB_DATA_DIR || path.join(process.cwd(), 'data'), 'uploads');

export async function POST(request: NextRequest) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const authorization = requireAdminMutation(request);
  if (isResponse(authorization)) return authorization;
  let form: FormData;
  try {
    const body = await readBody(request, MAX_FILE_BYTES + MAX_MULTIPART_OVERHEAD_BYTES);
    const contentType = request.headers.get('content-type');
    if (!contentType?.toLowerCase().startsWith('multipart/form-data;')) throw new Error('Некоректний формат завантаження.');
    const bodyBuffer = new ArrayBuffer(body.byteLength);
    new Uint8Array(bodyBuffer).set(body);
    form = await new Response(bodyBuffer, { headers: { 'content-type': contentType } }).formData();
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return NextResponse.json({ error: tooLarge ? 'Запит завеликий. Максимальний розмір файла — 8 МБ.' : 'Не вдалося прочитати файл.' }, { status: tooLarge ? 413 : 400, headers: noStore });
  }
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Оберіть зображення для завантаження.' }, { status: 400, headers: noStore });
  if (file.size <= 0 || file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'Зображення має бути не більшим за 8 МБ.' }, { status: 413, headers: noStore });
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) return NextResponse.json({ error: 'Дозволені формати: JPG, PNG, WebP або AVIF.' }, { status: 415, headers: noStore });
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const image = sharp(input, { limitInputPixels: 25_000_000, failOn: 'error' });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width > 7000 || metadata.height > 7000 || !['jpeg', 'png', 'webp', 'avif'].includes(metadata.format || '')) {
      return NextResponse.json({ error: 'Файл не є підтримуваним зображенням або має завелику роздільність.' }, { status: 415, headers: noStore });
    }
    const filename = `${randomUUID()}.webp`;
    const output = await image.rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), output, { flag: 'wx' });
    logEvent('info', 'admin.media_uploaded', { username: authorization.username, filename });
    return NextResponse.json({ src: `/api/media/${filename}` }, { status: 201, headers: noStore });
  } catch (error) {
    logEvent('error', 'media.upload_failed', { code: errorCode(error) });
    const unavailable = isStorageError(error);
    return NextResponse.json({ error: unavailable ? 'Сховище тимчасово недоступне. Спробуйте пізніше.' : 'Не вдалося обробити зображення. Спробуйте інший файл.' }, { status: unavailable ? 503 : 400, headers: noStore });
  }
}

export async function DELETE(request: NextRequest) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const authorization = requireAdminMutation(request);
  if (isResponse(authorization)) return authorization;
  let body: unknown;
  try { body = await readJson(request, 10_000); }
  catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return NextResponse.json({ error: tooLarge ? error.message : 'Перевірте формат запиту.' }, { status: tooLarge ? 413 : 400, headers: noStore });
  }
  const src = body && typeof body === 'object' && 'src' in body ? (body as { src: unknown }).src : null;
  if (typeof src !== 'string' || !/^\/api\/media\/[a-f0-9-]{36}\.webp$/i.test(src)) return NextResponse.json({ error: 'Посилання на файл має некоректний формат.' }, { status: 400, headers: noStore });
  try {
    const { unlink } = await import('node:fs/promises');
    const { removeMediaReferences } = await import('@/lib/store');
    const filePath = path.join(uploadDir, path.basename(src));
    removeMediaReferences(src);
    await unlink(filePath);
    logEvent('info', 'admin.media_deleted', { username: authorization.username, filename: path.basename(src) });
    return NextResponse.json({ removed: true }, { headers: noStore });
  } catch (error) {
    const missing = error && typeof error === 'object' && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT';
    if (!missing) logEvent('error', 'media.delete_failed', { code: errorCode(error) });
    return NextResponse.json({ error: missing ? 'Зображення вже видалено.' : 'Не вдалося видалити зображення.' }, { status: missing ? 404 : 500, headers: noStore });
  }
}
