import type { Metadata } from 'next';
import type { Service, Settings } from './types';

export type PageSeo = { title: string; description: string; path: string; settings: Settings };

export function getPublicOrigin(): URL | null {
  const value = process.env.BARBERLAB_PUBLIC_URL;
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return new URL('/', url.origin);
  } catch { return null; }
}

export function createPageMetadata({ title, description, path, settings }: PageSeo): Metadata {
  const origin = getPublicOrigin();
  const canonicalUrl = origin && path.startsWith('/') && !path.startsWith('//') ? new URL(path, origin) : undefined;
  const canonical = canonicalUrl && canonicalUrl.origin === origin?.origin ? canonicalUrl.toString() : undefined;
  const descriptionWithBusiness = `${description} ${settings.name} — ${settings.descriptor}. ${settings.address}`.replace(/\s+/g, ' ').trim().slice(0, 300);
  const shareTitle = `${settings.name} — ${title}`;
  const image = { url: '/logo-hd.png', width: 1983, height: 793, alt: `${settings.name} · ${settings.descriptor}` };
  return {
    title,
    description: descriptionWithBusiness,
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      type: 'website',
      locale: 'uk_UA',
      siteName: settings.name,
      title: shareTitle,
      description: descriptionWithBusiness,
      ...(canonical ? { url: canonical } : {}),
      ...(origin ? { images: [image] } : {}),
    },
    twitter: { card: 'summary_large_image', title: shareTitle, description: descriptionWithBusiness, ...(origin ? { images: [image] } : {}) },
  };
}

function serviceOffer(service: Service) {
  return {
    '@type': 'Offer',
    name: service.name,
    price: service.price,
    priceCurrency: 'UAH',
    itemOffered: { '@type': 'Service', name: service.name, serviceType: service.category },
    description: [service.note, `${service.duration} хв`].filter(Boolean).join(' · '),
  };
}

export function buildHairSalonJsonLd(settings: Settings, services: Service[]) {
  const origin = getPublicOrigin();
  const businessId = origin ? new URL('/#barberlab', origin).toString() : undefined;
  const visible = services.filter((service) => service.visible).sort((a, b) => a.order - b.order);
  return {
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    ...(businessId ? { '@id': businessId, url: origin!.toString() } : {}),
    name: settings.name,
    description: settings.descriptor,
    address: settings.address,
    telephone: settings.phoneLink.replace(/^tel:/, ''),
    sameAs: [settings.instagram, settings.tiktok, settings.facebook].filter(Boolean),
    ...(visible.length ? { hasOfferCatalog: { '@type': 'OfferCatalog', name: 'Послуги BARBERLAB', itemListElement: visible.map(serviceOffer) } } : {}),
  };
}

export function buildServicesJsonLd(settings: Settings, services: Service[]) {
  const origin = getPublicOrigin();
  const businessId = origin ? new URL('/#barberlab', origin).toString() : undefined;
  const visible = services.filter((service) => service.visible).sort((a, b) => a.order - b.order);
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Послуги ${settings.name}`,
    itemListElement: visible.map((service, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Service',
        name: service.name,
        serviceType: service.category,
        description: [service.note, `${service.duration} хв`].filter(Boolean).join(' · '),
        provider: { '@type': 'HairSalon', ...(businessId ? { '@id': businessId } : {}), name: settings.name },
        offers: serviceOffer(service),
      },
    })),
  };
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (char) => ({ '<': '\\u003c', '>': '\\u003e', '&': '\\u0026', '\u2028': '\\u2028', '\u2029': '\\u2029' })[char]!);
}
