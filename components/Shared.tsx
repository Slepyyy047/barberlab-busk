import Link from 'next/link';
import Image from 'next/image';
import type { Service, Settings } from '@/lib/types';
import { CookieSettingsButton, MotionToggle } from './CookiePreferences';

export function Booking({settings,label='Записатися',light=false}:{settings:Settings,label?:string,light?:boolean}) {
 return <a className={`button ${light?'button-light':''}`} href={settings.bookingUrl} target="_blank" rel="noopener noreferrer">{label}<span className="link-arrow" aria-hidden="true">↗</span></a>;
}
export function SectionHeading({eyebrow,title,children}:{eyebrow:string,title:React.ReactNode,children?:React.ReactNode}) {
 return <div className="section-heading" data-reveal data-motion="mask"><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{children}</div>;
}
export function PageHeading({number,title,description}:{number:string,title:string,description:string}) {
 return <section className="page-heading"><div className="container"><p className="eyebrow">BARBERLAB / {number}</p><h1>{title}</h1><p className="lead">{description}</p></div></section>;
}
export function ServiceRows({services,settings,reveal=true}:{services:Service[],settings:Settings,reveal?:boolean}) {
 return <div className="service-list">{services.map((s,i)=><article className="service-row" key={s.id} data-category={s.category} data-motion={i%2?'slide-right':'slide-left'} data-reveal={reveal?'':undefined} data-delay={reveal?Math.min(i*50,150):undefined}>
  <span className="row-number">{String(i+1).padStart(2,'0')}</span>
  <div className="service-name"><h3>{s.name}</h3><p>{s.duration} хв{s.note?` · ${s.note}`:''}</p></div>
  <strong>{new Intl.NumberFormat('uk-UA').format(s.price)} <span>₴</span></strong>
  <a href={settings.bookingUrl} target="_blank" rel="noopener noreferrer" className="service-book" aria-label={`Записатися: ${s.name}`}>Записатися <span className="link-arrow" aria-hidden="true">↗</span></a>
 </article>)}</div>;
}
export function Closing({settings}:{settings:Settings}) {
 return <section className="closing"><div className="container closing-inner" data-reveal><div><p className="eyebrow">ПОБАЧИМОСЯ У КРІСЛІ</p><h2>Твій час.<br/><span>Твій BARBERLAB.</span></h2></div><Booking settings={settings} label="Обрати свій час" light/></div></section>;
}
export function Footer({settings}:{settings:Settings}) {
 return <footer className="site-footer"><div className="container footer-top"><div><Link href="/" className="wordmark" aria-label="BARBERLAB — головна"><span className="logo-crop"><Image src="/logo-hd.png" alt="BARBERLAB" width={1983} height={793} unoptimized/></span></Link><p>{settings.descriptor}</p></div><div><p className="eyebrow">ЗАВІТАЙ</p><p>{settings.address}</p><a href={settings.phoneLink}>{settings.phone}</a></div><div><p className="eyebrow">МИ НА ЗВ’ЯЗКУ</p>{[["Instagram",settings.instagram],["TikTok",settings.tiktok],["Facebook",settings.facebook]].filter(([,url])=>url).map(([label,url])=><a key={label} href={url} target="_blank" rel="noopener noreferrer">{label} <span className="link-arrow" aria-hidden="true">↗</span></a>)}</div></div><nav className="container footer-legal" aria-label="Правова інформація та налаштування"><Link href="/privacy">Конфіденційність</Link><Link href="/terms">Умови використання</Link><Link href="/cookies">Використання cookie</Link><Link href="/licenses">Ліцензії та матеріали</Link><CookieSettingsButton/><MotionToggle/></nav><div className="container footer-bottom"><span>© {new Date().getFullYear()} BARBERLAB</span><span>Стиль починається з деталей.</span></div></footer>;
}



