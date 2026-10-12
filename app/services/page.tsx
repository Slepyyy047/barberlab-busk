import ToolField from '@/components/ToolField';
import type { Metadata } from 'next';
import { getPublicContent as getContent } from '@/lib/public-content';
import { createPageMetadata } from '@/lib/seo';
import { ServicesStructuredData } from '@/components/BusinessData';
import { PageHeading,Closing } from '@/components/Shared';
import ServiceFilter from '@/components/ServiceFilter';
export function generateMetadata():Metadata{const {settings}=getContent();return createPageMetadata({path:'/services',title:'Послуги та ціни',description:'Чоловічі й дитячі стрижки, догляд за бородою та камуфлювання сивини.',settings});}
export default function Services(){const c=getContent();const services=c.services.filter(s=>s.visible).sort((a,b)=>a.order-b.order);return <><ServicesStructuredData services={services} settings={c.settings}/><PageHeading number="01 / ПОСЛУГИ" title="Послуги та ціни." description="Стрижки, борода й догляд. Обери, що потрібно цього разу."/><section className="section paper decorated-section"><ToolField variant="services"/><div className="container"><ServiceFilter services={services} settings={c.settings} categoryLabels={c.services.map(s=>s.category)}/><p className="small-note">Остаточну ціну та доступність уточнюйте під час запису. Кнопка відкриває загальну сторінку Altegio — послугу та майстра можна обрати там.</p></div></section><Closing settings={c.settings}/></>}



