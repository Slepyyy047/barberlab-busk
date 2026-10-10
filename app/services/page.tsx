import ToolField from '@/components/ToolField';
import type { Metadata } from 'next';
import { getContent } from '@/lib/store';
import { PageHeading,Closing } from '@/components/Shared';
import ServiceFilter from '@/components/ServiceFilter';
export const metadata:Metadata={...(process.env.BARBERLAB_PUBLIC_URL?{alternates:{canonical:"/services"}}:{}),title:'Послуги та ціни',description:'Чоловічі та дитячі стрижки, борода, камуфлювання сивини. Ціни й тривалість послуг BARBERLAB у Буську.'};
export default function Services(){const c=getContent();return <><PageHeading number="01 / ПОСЛУГИ" title="Добре виглядати. Просто." description="Обери свій ритуал — від звичної стрижки до повного догляду."/><section className="section paper decorated-section"><ToolField variant="services"/><div className="container"><ServiceFilter services={c.services.filter(s=>s.visible).sort((a,b)=>a.order-b.order)} settings={c.settings} categoryLabels={c.services.map(s=>s.category)}/><p className="small-note">Остаточну ціну та доступність уточнюйте під час запису. Кнопка відкриває загальну сторінку Altegio — послугу та майстра можна обрати там.</p></div></section><Closing settings={c.settings}/></>}



