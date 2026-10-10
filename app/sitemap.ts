import type {MetadataRoute} from 'next';
export default function sitemap():MetadataRoute.Sitemap{const url=process.env.BARBERLAB_PUBLIC_URL;if(!url)return [];return ['','/services','/team','/contacts'].map(p=>({url:url+p}))}
