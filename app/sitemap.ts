import type { MetadataRoute } from 'next';
import { getPublicOrigin } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getPublicOrigin();
  if (!origin) return [];
  return ['/', '/services', '/team', '/contacts'].map(route => ({ url: new URL(route, origin).toString() }));
}
