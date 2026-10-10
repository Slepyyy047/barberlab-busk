/** Subtle decorative line art; never presented as a brand mark or salon photo. */
export default function BarberDetails({className=''}:{className?:string}) {
 return <div className={`barber-details ${className}`} aria-hidden="true">
  <svg className="detail-scissors" viewBox="0 0 80 100" fill="none"><circle cx="20" cy="78" r="10"/><circle cx="57" cy="78" r="10"/><path d="M26 70 62 12 42 58M51 70 16 12 36 58"/><circle cx="39" cy="60" r="2"/></svg>
  <svg className="detail-comb" viewBox="0 0 110 60" fill="none"><path d="M8 13h94v11H8zM12 24v24m8-24v24m8-24v24m8-24v24m8-24v24m8-24v24m8-24v24m8-24v24m8-24v24m8-24v24m8-24v24m8-24v24"/></svg>
 </div>;
}
