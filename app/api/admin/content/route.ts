import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { isResponse, noStore, readJson, rejectCrossOrigin, requireAdmin, requireAdminMutation, RequestBodyTooLargeError } from '@/lib/http';
import { getContent, saveContent } from '@/lib/store';
import { ContentValidationError } from '@/lib/validation';

export const runtime = 'nodejs';
export function GET(request: NextRequest) {
  const authorization = requireAdmin(request);
  if (isResponse(authorization)) return authorization;
  return NextResponse.json(getContent(), { headers: noStore });
}
export async function PUT(request: NextRequest) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const authorization = requireAdminMutation(request);
  if (isResponse(authorization)) return authorization;
  let body: unknown;
  try { body = await readJson(request); }
  catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return NextResponse.json({ error: tooLarge ? error.message : 'Перевірте формат запиту.' }, { status: tooLarge ? 413 : 400, headers: noStore });
  }
  try {
    const saved = saveContent(body);
    revalidatePath('/', 'layout');
    return NextResponse.json({ content: saved }, { headers: noStore });
  } catch (error) {
    if (error instanceof ContentValidationError) return NextResponse.json({ error: error.message }, { status: 400, headers: noStore });
    return NextResponse.json({ error: 'Не вдалося зберегти зміни. Спробуйте ще раз.' }, { status: 500, headers: noStore });
  }
}
