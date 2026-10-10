import type { NextConfig } from 'next';
const indexing = process.env.BARBERLAB_ALLOW_INDEXING === 'true' && Boolean(process.env.BARBERLAB_PUBLIC_URL);
const config: NextConfig = { images: { qualities: [70,75], localPatterns: [{pathname:'/generated-tools/**',search:'?v=20261010'},{pathname:'/**',search:''}] }, serverExternalPackages: ['node:sqlite'], poweredByHeader: false, async headers() { return [{ source: '/:path*', headers: [{key:'X-Robots-Tag',value:indexing?'index, follow':'noindex, nofollow'},{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'X-Frame-Options',value:'DENY'}] }, {source:'/admin/:path*',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}]},{source:'/api/:path*',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}]}]; } };
export default config;

