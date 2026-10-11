import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import ToolField from '@/components/ToolField';
import BusinessData from '@/components/BusinessData';
import { getPublicContent as getContent } from '@/lib/public-content';
import { createPageMetadata } from '@/lib/seo';
import { Booking, Closing, SectionHeading, ServiceRows } from '@/components/Shared';

export function generateMetadata(): Metadata {
 const {settings}=getContent();
 return createPageMetadata({settings,path:'/',title:'Барбершоп у Буську',description:'Чоловічі та дитячі стрижки, догляд за бородою й увага до деталей.',});
}

export default function Home() {
 const c=getContent(),s=c.settings;
 const staff=c.staff.filter(p=>p.visible).sort((a,b)=>a.order-b.order);
 const services=c.services.filter(p=>p.visible).sort((a,b)=>a.order-b.order).slice(0,4);
 return <><BusinessData settings={s}/>
  <section id="top" className="hero reference-hero" data-scroll-scene>
   <div className="hero-backdrop" aria-hidden="true" data-ambient-motion><Image src="/generated-background.png" alt="" fill sizes="100vw" quality={75} priority/></div><ToolField variant="hero"/>
   <div className="container hero-topline"><span>Буськ / майдан Незалежності, 1</span><span>Барбершоп</span></div>
   <div className="container hero-brand" data-hero-motion><div className="hero-logo"><Image src="/logo-hd.png" alt="BARBERLAB" width={1983} height={793} unoptimized priority/></div></div>
   <div className="container hero-bottom-layout"><div className="hero-copy"><h1><span>Стиль.</span><span className="outline-word">Деталі.</span><span>Характер.</span></h1></div><div className="hero-info"><p>Чоловічі стрижки та догляд за бородою.<br/>У центрі Буська. З увагою до тебе.</p><div className="hero-actions"><Booking settings={s} label="Обрати час"/><a className="text-link" href="#team">Обрати майстра <span className="link-arrow" aria-hidden="true">↗</span></a></div><p className="hero-hours">{s.hours}</p></div></div>
   <div className="container hero-bottom"><span>BARBERLAB · БУСЬК</span><a href="#experience">Відчуй ритм <span className="link-arrow" aria-hidden="true">↓</span></a></div>
  </section>
  <section className="kinetic-intro" aria-label="Стрижки, борода та стиль"><div className="kinetic-line" aria-hidden="true" data-ambient-motion>{[0,1].map(copy=><div className="kinetic-group" key={copy}>СТРИЖКИ <span className="kinetic-divider">/</span> БОРОДА <span className="kinetic-divider">/</span> СТИЛЬ <span className="kinetic-divider">/</span></div>)}</div></section>
  <section id="experience" className="experience-section section" data-scroll-scene><div className="container experience-grid"><div className="experience-stage" data-reveal data-motion="mask"><ToolField variant="experience"/><span className="experience-stage-caption">Інструменти. Рух. Увага до деталей.</span></div><div className="experience-copy"><p className="eyebrow" data-reveal>01 / ТВІЙ РИТМ</p><h2 data-reveal data-motion="slide-right">Без поспіху.<br/><span>З увагою<br/>до тебе.</span></h2><p data-reveal>Чоловічі та дитячі стрижки, борода й час для себе. Заходь до BARBERLAB у центрі Буська.</p><div className="amenity-lines">{s.amenities.slice(0,4).map((a,i)=><span data-reveal data-motion="slide-right" data-delay={i*60} key={a}>{a}</span>)}</div><a className="text-link" href="#team">Хто створює твій стиль <span className="link-arrow" aria-hidden="true">↓</span></a></div></div></section>
  {staff.length>0&&<section id="team" className="team-brief section"><ToolField variant="team"/><div className="container"><div className="heading-flex"><SectionHeading eyebrow="02 / КОМАНДА" title="За стилем — люди."/><Link href="/team" className="text-link">Уся команда <span className="link-arrow" aria-hidden="true">↗</span></Link></div><div className="home-team-list">{staff.map((person,i)=><Link href="/team" className="home-person" key={person.id} data-reveal data-motion="mask" data-delay={i*70}>{person.portrait&&<div className="home-person-photo"><Image src={person.portrait} alt={`Портрет: ${person.name}`} width={400} height={500} unoptimized/></div>}<span>{person.name}</span><small>{person.level}</small></Link>)}</div></div></section>}
  <section id="services" className="section services-preview"><ToolField variant="services"/><div className="container"><div className="heading-flex"><SectionHeading eyebrow="03 / ПОСЛУГИ" title={<>Форма, яка<br/><span>пасує тобі.</span></>}/><Link className="text-link" href="/services">Усі послуги та ціни <span className="link-arrow" aria-hidden="true">↗</span></Link></div><ServiceRows services={services} settings={s}/><p className="small-note">Остаточну ціну та вільний час уточнюйте під час запису.</p></div></section>
  {c.reviews.length>0&&<section id="reviews" className="reviews section"><ToolField variant="reviews"/><div className="container"><div className="heading-flex"><SectionHeading eyebrow="04 / ВІДГУКИ" title="Слово нашим гостям."/><div className="review-rating"><strong>{s.rating}<span>/5</span></strong><p>{s.reviewCount} відгуків · Google<br/><small>За наданими даними</small></p></div></div><div className="review-grid">{c.reviews.map((r,i)=><blockquote key={r.name} data-reveal data-motion={i%2?'slide-right':'slide-left'} data-delay={i*80}><span className="quote-mark" aria-hidden="true">“</span><p>{r.text}</p><cite>{r.name}</cite></blockquote>)}</div></div></section>}
  <section id="contacts" className="section location-section"><ToolField variant="contacts"/><div className="container visit-grid"><SectionHeading eyebrow="05 / БУСЬК" title={<>Зустрінемось<br/>у центрі.</>}/><div data-reveal data-motion="slide-right"><p className="visit-address">{s.address}</p><p>{s.hours}</p><a className="phone-large" href={s.phoneLink}>{s.phone}</a><Link href="/contacts" className="text-link">Як нас знайти <span className="link-arrow" aria-hidden="true">↗</span></Link></div></div></section><Closing settings={s}/>
 </>;
}
