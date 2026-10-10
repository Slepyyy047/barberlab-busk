import type { MetadataRoute } from 'next';
import { getPublicOrigin } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export default function robots(): MetadataRoute.Robots {
  const origin = getPublicOrigin();
  return process.env.BARBERLAB_ALLOW_INDEXING === 'true' && origin
    ? { rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api'] }, sitemap: new URL('/sitemap.xml', origin).toString() }
    : { rules: { userAgent: '*', disallow: '/' } };
}
