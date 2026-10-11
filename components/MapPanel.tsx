'use client';
import { useState } from 'react';
import { useCookiePreferences } from './CookiePreferences';

export default function MapPanel({ address }: { address: string }) {
  const [loaded, setLoaded] = useState(false);
  const { externalMedia, openSettings } = useCookiePreferences();
  const query = encodeURIComponent(`BARBERLAB ${address}`);
  return <div className="map-panel">
    {loaded && externalMedia ? <iframe title="Карта розташування BARBERLAB — Google Maps" src={`https://maps.google.com/maps?q=${query}&output=embed`} loading="lazy" referrerPolicy="no-referrer" /> : <>
      <span className="map-pin" aria-hidden="true">⌖</span><h3>Зустрінемось у Буську.</h3><p>{address}</p>
      <button type="button" className="button" onClick={() => externalMedia ? setLoaded(true) : openSettings()}>{externalMedia ? 'Показати карту' : 'Налаштувати cookie для карти'}</button>
      <p className="small-note">Google-карта завантажується лише після дозволу зовнішнього контенту та натискання «Показати карту».</p>
      <a className="text-link" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer">Відкрити маршрут на Google Maps ↗</a>
    </>}
  </div>;
}

