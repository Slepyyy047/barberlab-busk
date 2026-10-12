import { NextResponse } from 'next/server';

// The hosted preview has no durable storage for admin sessions or uploads.
export function proxy() {
  if (process.env.VERCEL) return new NextResponse('Не знайдено', { status: 404 });
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*', '/api/admin/:path*', '/api/media/:path*'] };
