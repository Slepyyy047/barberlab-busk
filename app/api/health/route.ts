import { NextResponse } from 'next/server';
import { checkHealth } from '@/lib/health';
import { errorCode, logEvent } from '@/lib/observability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET() {
  try {
    await checkHealth();
    return NextResponse.json({ status: 'ok' }, { headers });
  } catch (error) {
    logEvent('error', 'health.failed', { code: errorCode(error) });
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers });
  }
}
