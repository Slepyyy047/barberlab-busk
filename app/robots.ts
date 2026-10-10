import type {MetadataRoute} from 'next';
export default function robots():MetadataRoute.Robots{const url=process.env.BARBERLAB_PUBLIC_URL;return process.env.BARBERLAB_ALLOW_INDEXING==='true'&&url?{rules:{userAgent:'*',allow:'/',disallow:['/admin','/api']},sitemap:url+'/sitemap.xml'}:{rules:{userAgent:'*',disallow:'/'}}}
