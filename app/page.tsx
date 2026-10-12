import ArrowIcon from '@/components/ArrowIcon';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import BusinessData from '@/components/BusinessData';
import VisitPicker from '@/components/VisitPicker';
import ReviewStories from '@/components/ReviewStories';
import { getPublicContent as getContent } from '@/lib/public-content';
import { createPageMetadata } from '@/lib/seo';
import { Booking, Closing, SectionHeading } from '@/components/Shared';

export function generateMetadata(): Metadata {
 const {settings}=getContent();
 return createPageMetadata({settings,path:'/',title:'Барбершоп у Буську',description:'Чоловічі та дитячі стрижки, догляд за бородою й увага до деталей.',});
}

export default function Home() {
 const c=getContent(),s=c.settings;
 const staff=c.staff.filter(p=>p.visible).sort((a,b)=>a.order-b.order);
 const heroStaff=staff.filter(person=>person.portrait).slice(0,3);
 const services=c.services.filter(p=>p.visible).sort((a,b)=>a.order-b.order);

 return <><BusinessData settings={s}/>
  <section id="top" className="hero cut-hero" data-scroll-scene>
   <div className="container hero-topline"><a className="hero-address" href="#contacts"><span className="address-marker" aria-hidden="true"><span className="address-pulse" data-ambient-motion/><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></span><span>{s.address}</span><span className="address-arrow" aria-hidden="true"><ArrowIcon/></span></a><span className="hero-descriptor">Барбершоп</span></div>
   <div className={`container cut-hero-title${heroStaff.length ? ' has-portraits' : ''}`} data-hero-motion>
    <h1 aria-label="Чоловічі стрижки. Догляд за бородою."><span className="hero-line"><span>Чоловічі</span></span><span className="cut-word"><span className="cut-word-text">стрижки.</span><span className="cut-half cut-half--top" aria-hidden="true">стрижки.</span><span className="cut-half cut-half--bottom" aria-hidden="true">стрижки.</span></span><span className="hero-subtitle">Догляд за бородою.</span></h1>
    {heroStaff.length>0&&<a className="hero-team-preview" href="#team"><span className="hero-portraits">{heroStaff.map(person=><span className="hero-portrait" key={person.id}><Image src={person.portrait!} alt={person.name} width={400} height={500} unoptimized/></span>)}</span><span className="hero-team-caption">Наші майстри <span aria-hidden="true"><ArrowIcon/></span></span></a>}
    <span className="cut-rule" aria-hidden="true"/>
   </div>
   <div className="container cut-hero-details">
    <p className="hero-intro">Для дорослих і дітей. У центрі Буська.</p>
    <div className="hero-booking"><div className="hero-actions"><Booking settings={s} label="Записатися на стрижку" featured/><a className="text-link" href={services.length?'#visit-picker':'#team'}>{services.length?'Послуги та ціни':'Майстри'} <span className="link-arrow" aria-hidden="true"><ArrowIcon direction="down"/></span></a></div></div>
   </div>
   <div className="container hero-bottom"><span>{s.hours}</span><a href="#experience">Далі <span className="scroll-tick" aria-hidden="true" data-ambient-motion><ArrowIcon direction="down"/></span></a></div>
  </section>
  <section className="kinetic-intro" aria-label="Стрижки, борода та стиль"><div className="kinetic-line" aria-hidden="true" data-ambient-motion>{[0,1].map(copy=><div className="kinetic-group" key={copy}>СТРИЖКИ <span className="kinetic-divider">/</span> БОРОДА <span className="kinetic-divider">/</span> СТИЛЬ <span className="kinetic-divider">/</span></div>)}</div></section>
  <section id="experience" className="experience-section section craft-section" data-scroll-scene>
   <div className="container experience-grid">
    <div className="experience-stage craft-stage">
     <span className="craft-type" aria-hidden="true">СТРИЖКА</span>
     <span className="craft-measure" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/></span>
     <div className="clipper-turn" aria-hidden="true"><Image src="/generated-tools/clipper.png?v=20261010" alt="" width={500} height={500} sizes="(max-width:780px) 280px, 480px" quality={75}/></div>
     <span className="experience-stage-caption">BARBERLAB / Буськ</span><span className="craft-track" aria-hidden="true"><i/></span>
    </div>
    <div className="experience-copy"><h2 data-reveal data-motion="cut">Стрижки.<br/><span>Борода. Догляд.</span></h2><p data-reveal>Покажи майстру фото стрижки або розкажи, що хочеш змінити.</p><div className="amenity-lines">{s.amenities.slice(0,4).map((a,i)=><span data-reveal data-motion="slide-right" data-delay={i*60} key={a}>{a}</span>)}</div><a className="text-link" href="#team">Обрати майстра <span className="link-arrow" aria-hidden="true"><ArrowIcon direction="down"/></span></a></div>
   </div>
  </section>
  {staff.length>0&&<section id="team" className="team-brief section portrait-section"><div className="container">
   <div className="heading-flex"><SectionHeading eyebrow="" title="Майстри"/><Link href="/team" className="text-link">Про майстрів <span className="link-arrow" aria-hidden="true"><ArrowIcon/></span></Link></div>
   <div className="home-team-list">{staff.map((person,i)=><Link href={`/team#${encodeURIComponent(person.id)}`} className="home-person" key={person.id} data-reveal data-motion="portrait" data-delay={i*70}>
    {person.portrait&&<div className="home-person-photo"><Image src={person.portrait} alt={`Портрет: ${person.name}`} width={640} height={800} unoptimized/><span className="portrait-index" aria-hidden="true">{String(i+1).padStart(2,'0')}</span><span className="portrait-arrow" aria-hidden="true"><ArrowIcon/></span></div>}
    <span>{person.name}</span><small>{person.level}</small>
   </Link>)}</div>

  </div></section>}
  <section id="services" className="section services-preview"><div className="container"><div className="heading-flex"><SectionHeading eyebrow="" title="Послуги та ціни"/><Link className="text-link" href="/services">Усі послуги та ціни <span className="link-arrow" aria-hidden="true"><ArrowIcon/></span></Link></div><VisitPicker services={services} bookingUrl={s.bookingUrl}/></div></section>
  {c.reviews.length>0&&<section id="reviews" className="reviews section"><div className="container"><div className="heading-flex"><SectionHeading eyebrow="" title="Відгуки клієнтів"/>{s.rating>0&&s.reviewCount>0&&<div className="review-rating"><strong>{s.rating}<span>/5</span></strong><p>{s.reviewCount} відгуків · Google<br/><small>За наданими даними</small></p></div>}</div><ReviewStories reviews={c.reviews}/></div></section>}
  <section id="contacts" className="section location-section"><div className="container visit-grid"><div><SectionHeading eyebrow="" title="Контакти"/><div className="contact-art" data-reveal><Image src="/contact-still-life.webp" alt="" width={1200} height={800} sizes="(max-width: 780px) 100vw, 50vw"/></div></div><div data-reveal><p className="visit-address">{s.address}</p><p>{s.hours}</p><a className="phone-large" href={s.phoneLink}>{s.phone}</a><Link href="/contacts" className="button location-button"><span className="location-dot" aria-hidden="true"/><span>Як нас знайти</span><span className="link-arrow" aria-hidden="true"><ArrowIcon/></span></Link></div></div></section><Closing settings={s}/>
 </>;
}
