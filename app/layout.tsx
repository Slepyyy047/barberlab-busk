import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { getPublicContent as getContent } from '@/lib/public-content';
import { getPublicOrigin } from '@/lib/seo';
import ScrollMotion from '@/components/ScrollMotion';
import Navigation from '@/components/Navigation';
import { Footer } from '@/components/Shared';
import './globals.css';
const manrope=localFont({src:[{path:'../public/fonts/font-0.ttf',weight:'400'},{path:'../public/fonts/font-2.ttf',weight:'600'},{path:'../public/fonts/font-3.ttf',weight:'700'}],variable:'--font-body',display:'swap'});
const oswald=localFont({src:[{path:'../public/fonts/font-6.ttf',weight:'500'}],variable:'--font-heading',display:'swap'});
export const dynamic='force-dynamic';
const publicOrigin=getPublicOrigin();
const indexing=process.env.BARBERLAB_ALLOW_INDEXING==='true'&&Boolean(publicOrigin);
export const metadata:Metadata={...(publicOrigin?{metadataBase:publicOrigin}:{}),title:{default:'BARBERLAB — Барбершоп у Буську',template:'%s · BARBERLAB'},description:'Чоловічі стрижки, догляд за бородою та увага до деталей у Буську.',robots:{index:indexing,follow:indexing},icons:{icon:'/logo-source.png'}};
export default function RootLayout({children}:{children:React.ReactNode}) {const {settings}=getContent();return <html lang="uk" data-scroll-behavior="smooth"><body className={`${manrope.variable} ${oswald.variable}`}><a href="#main" className="skip-link">Перейти до вмісту</a><Navigation bookingUrl={settings.bookingUrl}/><main id="main">{children}</main><Footer settings={settings}/><ScrollMotion/></body></html>}



