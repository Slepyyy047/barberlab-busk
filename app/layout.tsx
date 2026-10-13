import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { getPublicContent as getContent } from '@/lib/public-content';
import { getPublicOrigin } from '@/lib/seo';
import ScrollMotion from '@/components/ScrollMotion';
import Navigation from '@/components/Navigation';
import { Footer } from '@/components/Shared';
import CookiePreferences from '@/components/CookiePreferences';
import './globals.css';
import './privacy-ui.css';
import './accessibility.css';
import './home-motion.css';
import './booking-flow.css';
import './review-stories.css';
const sourceSans=localFont({src:'../public/fonts/SourceSans3-Variable.woff2',weight:'200 900',style:'normal',variable:'--font-body',display:'swap'});
export const dynamic='force-dynamic';
const publicOrigin=getPublicOrigin();
const indexing=process.env.BARBERLAB_ALLOW_INDEXING==='true'&&Boolean(publicOrigin);
export const metadata:Metadata={...(publicOrigin?{metadataBase:publicOrigin}:{}),title:{default:'BARBERLAB — Барбершоп у Буську',template:'%s · BARBERLAB'},description:'Чоловічі стрижки, догляд за бородою та увага до деталей у Буську.',robots:{index:indexing,follow:indexing},icons:{icon:'/logo-source.png'}};
export default function RootLayout({children}:{children:React.ReactNode}) {const {settings}=getContent();return <html lang="uk" data-scroll-behavior="smooth"><body className={sourceSans.variable}><a href="#main" className="skip-link">Перейти до вмісту</a><CookiePreferences navigation={<Navigation bookingUrl={settings.bookingUrl}/>}><main id="main" tabIndex={-1}>{children}</main><Footer settings={settings}/><ScrollMotion/></CookiePreferences></body></html>}



