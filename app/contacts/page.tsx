import ToolField from '@/components/ToolField';
import type {Metadata} from 'next';
import {getPublicContent as getContent} from '@/lib/public-content';
import {createPageMetadata} from '@/lib/seo';
import {PageHeading,Booking} from '@/components/Shared';
import MapPanel from '@/components/MapPanel';
export function generateMetadata():Metadata{const {settings}=getContent();return createPageMetadata({path:'/contacts',title:'Контакти та запис',description:`Зателефонуй за номером ${settings.phone} або обери час онлайн. Дізнайся, як до нас дістатися.`,settings});}
export default function Contacts(){const {settings:s}=getContent();return <><PageHeading number="05 / КОНТАКТИ" title="Твій наступний візит." description="Знайди нас у центрі Буська. Обери час онлайн або зателефонуй."/><section className="section paper decorated-section"><ToolField variant="contacts"/><div className="container contact-grid"><div><div className="contact-details"><div><h2>АДРЕСА</h2><p className="visit-address">{s.address}</p><a className="text-link" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.address)}`} target="_blank" rel="noopener noreferrer">Прокласти маршрут ↗</a></div><div><h2>ТЕЛЕФОН</h2><a className="phone-large" href={s.phoneLink}>{s.phone}</a></div><div><h2>ГОДИНИ РОБОТИ</h2>{s.weeklyHours.length?s.weeklyHours.map(d=><p key={d.day}>{d.day}: {d.closed?'Вихідний':`${d.open}–${d.close}`}</p>):<p>{s.hours}</p>}</div><div><h2>СОЦІАЛЬНІ МЕРЕЖІ</h2><p>{[["Instagram",s.instagram],["TikTok",s.tiktok],["Facebook",s.facebook]].filter(([,url])=>url).map(([label,url])=><span key={label}><a href={url} target="_blank" rel="noopener noreferrer">{label} ↗</a><br/></span>)}</p></div><div><h2>ЗАПИС ОНЛАЙН</h2><p>Обери послугу, майстра та час на сторінці Altegio.</p><Booking settings={s}/></div></div></div><MapPanel address={s.address}/></div></section></>}



