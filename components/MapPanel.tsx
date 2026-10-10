'use client';
import {useState} from 'react';
export default function MapPanel({address}:{address:string}){const [loaded,setLoaded]=useState(false);const query=encodeURIComponent(`BARBERLAB ${address}`);return <div className="map-panel">{loaded?<iframe title="Карта розташування BARBERLAB" src={`https://maps.google.com/maps?q=${query}&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/>:<><span className="map-pin" aria-hidden="true">⌖</span><h3>Зустрінемось у Буську.</h3><p>{address}</p><button className="button" onClick={()=>setLoaded(true)}>Показати карту</button><p className="small-note">Карта завантажиться з Google після натискання.</p></>}</div>}

