import type { Service, Settings } from '@/lib/types';
import { getPublicContent } from '@/lib/public-content';
import { buildHairSalonJsonLd, buildServicesJsonLd, serializeJsonLd } from '@/lib/seo';

export default function BusinessData({ settings }: { settings: Settings }) {
  const { services } = getPublicContent();
  const data = buildHairSalonJsonLd(settings, services);
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}

export function ServicesStructuredData({ settings, services }: { settings: Settings; services: Service[] }) {
  const data = buildServicesJsonLd(settings, services);
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
