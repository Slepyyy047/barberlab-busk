'use client';
import ArrowIcon from '@/components/ArrowIcon';


import { useRef, useState } from 'react';
import Link from 'next/link';
import type { Service } from '@/lib/types';

const featuredIds = ['mens-cut', 'beard-trim', 'mens-cut-beard'];
const money = new Intl.NumberFormat('uk-UA');

/** A local shortlist, not an appointment or a prefilled external booking. */
export default function VisitPicker({ services, bookingUrl }: { services: Service[]; bookingUrl: string }) {
  const published = services.filter(service => service.visible).sort((a, b) => a.order - b.order);
  const featured = featuredIds.flatMap(id => published.filter(service => service.id === id));
  const options = [...featured, ...published.filter(service => !featuredIds.includes(service.id))].slice(0, 3);
  const [selectedId, setSelectedId] = useState<string | null>(() => options[0]?.id ?? null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const selected = options.find(service => service.id === selectedId);
  if (!options.length) return null;

  return <div className="visit-picker" id="visit-picker">
   <div className="visit-menu">

    <div className="visit-options" role="group" aria-label="Обери послугу для візиту">
      {options.map((service, index) => <button type="button" key={service.id} aria-pressed={selectedId === service.id} aria-controls="visit-summary" onClick={(event) => {
        setSelectedId(service.id);
        // Touch/pointer choices reveal the result below; keyboard focus stays on the options.
        if (event.detail > 0 && window.matchMedia('(max-width: 780px)').matches) {
          const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motionPaused === 'true';
          summaryRef.current?.scrollIntoView({ block: 'start', behavior: still ? 'instant' : 'smooth' });
        }
      }}>
        <span className="visit-option-index" aria-hidden="true">0{index + 1}</span><span className="visit-option-copy"><span>{service.name}</span><small>{money.format(service.price)} ₴ <span aria-hidden="true">/</span> {service.duration} хв</small></span><span className="visit-option-mark" aria-hidden="true">{selectedId === service.id ? '✓' : '+'}</span>
      </button>)}
    </div>
    <Link href="/services" className="visit-all text-link">Повне меню послуг <span aria-hidden="true"><ArrowIcon/></span></Link>
   </div>
   <div className="visit-summary-shell" ref={summaryRef}>
    <span className="visit-summary-label eyebrow">Обрана послуга</span>
    <div id="visit-summary" className="visit-summary" aria-live="polite" aria-atomic="true">
      {selected ? <div key={selected.id} className="visit-summary-inner">
        <div className="visit-selection"><h4>{selected.name}</h4>{selected.note && <p>{selected.note}</p>}<div className="visit-facts"><strong>{money.format(selected.price)} <span>₴</span></strong><span>{selected.duration} хв</span></div></div>
        <div className="visit-next"><a className="button" href={bookingUrl} target="_blank" rel="noopener noreferrer">Перейти до запису <span className="link-arrow" aria-hidden="true"><ArrowIcon/></span></a><p>Далі в Altegio обери цю послугу, майстра та час. Остаточну ціну уточнюй під час запису.</p></div>
      </div> : <div className="visit-empty"><p>Обери послугу зі списку.</p><noscript><p>Для вибору тут потрібен JavaScript. <Link href="/services">Відкрити послуги та запис</Link>.</p></noscript></div>}
    </div>
   </div>
  </div>;
}
