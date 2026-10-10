import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { noStore } from '@/lib/http';

export const runtime = 'nodejs';
export function GET(request: NextRequest) {
  const username = getSession(request);
  return NextResponse.json(username ? { authenticated: true, username } : { authenticated: false }, { headers: noStore });
}
