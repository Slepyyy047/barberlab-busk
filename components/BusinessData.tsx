import type {Settings} from '@/lib/types';
export default function BusinessData({settings:s}:{settings:Settings}){const data={'@context':'https://schema.org','@type':'HairSalon',name:s.name,alternateName:'Barbershop.Busk',description:s.descriptor,address:s.address,telephone:s.phoneLink.replace('tel:',''),sameAs:[s.instagram,s.tiktok,s.facebook].filter(Boolean),...(process.env.BARBERLAB_PUBLIC_URL?{url:process.env.BARBERLAB_PUBLIC_URL}:{})};return <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(data).replace(/</g,'\\u003c')}}/>}

