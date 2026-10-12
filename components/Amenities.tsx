function AmenityIcon({ label }: { label: string }) {
  const value = label.toLocaleLowerCase('uk-UA');
  let drawing;
  if (value.includes('карт')) {
    drawing = <><rect x="4" y="7" width="24" height="18" rx="3"/><path d="M4 13h24M8 20h5"/><path className="amenity-signal" d="M22 17v3m3-4v5"/></>;
  } else if (value.includes('nfc')) {
    drawing = <><rect x="5" y="5" width="12" height="22" rx="3"/><path d="M10 23h2"/><g className="amenity-signal"><path d="M21 12a6 6 0 0 1 0 8M25 8a12 12 0 0 1 0 16"/></g></>;
  } else if (value.includes('дит')) {
    drawing = <><circle cx="9" cy="23" r="4"/><circle cx="23" cy="23" r="4"/><path d="m12 20 12-15M20 20 8 5m8 10 3-4"/></>;
  } else if (value.includes('кав')) {
    drawing = <><path d="M6 14h17v8a5 5 0 0 1-5 5h-7a5 5 0 0 1-5-5Zm17 1h2a4 4 0 0 1 0 8h-2M4 28h22"/><g className="amenity-steam"><path d="M11 10c-3-3 3-4 0-7M18 10c-3-3 3-4 0-7"/></g></>;
  } else if (value.includes('очіку')) {
    drawing = <><path d="M8 17V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v9M5 14v7h22v-7M9 21v7m14-7v7M8 17h16"/></>;
  } else if (value.includes('вхід') || value.includes('парку')) {
    drawing = <><path d="M5 27V5h15v22M3 27h19M24 12h2a4 4 0 0 1 0 8h-2m0-8v14M15 16h1"/></>;
  } else {
    drawing = <path d="m8 16 5 5L25 9"/>;
  }
  return <svg className="amenity-icon" data-ambient-motion viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{drawing}</svg>;
}

export default function Amenities({ items }: { items: string[] }) {
  if (!items.length) return null;
  return <ul className="amenity-list" aria-label="Зручності в BARBERLAB">
    {items.map((label, index) => <li className="amenity-row" key={label} data-reveal data-motion="slide-right" data-delay={index * 70}>
      <div className="amenity-emblem"><AmenityIcon label={label}/></div>
      <span>{label}</span>
    </li>)}
  </ul>;
}
