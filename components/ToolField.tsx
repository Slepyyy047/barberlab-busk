import Image from 'next/image';
import type { CSSProperties } from 'react';

const sets = {
 hero:['clipper','scissors','straight-razor'],
 experience:['hairdryer','comb','shaving-brush','neck-duster'],
 team:['thinning-scissors','round-brush'],
 services:['trimmer','foil-shaver','spray-bottle'],
 reviews:['pomade-tin','dropper-bottle'],
 contacts:['folded-towel'],
} as const;

/** Generated decorative objects, separate from the business's real photographs. */
export default function ToolField({variant}:{variant:keyof typeof sets}) {
 return <div className={`tool-field tool-field--${variant}`} aria-hidden="true">{sets[variant].map((slug,index)=><div className={`tool-anchor tool-anchor--${index+1}`} data-parallax={24+index*12} key={slug} style={{'--tool-angle':`${index%2?-16:18}deg`,'--tool-delay':`${-index*2.7}s`,'--tool-duration':`${9+index*1.8}s`} as CSSProperties}><div className="tool-float" data-ambient-motion><Image src={`/generated-tools/${slug}.png?v=20261010`} alt="" width={400} height={400} sizes="(max-width: 780px) 150px, 260px" quality={70}/></div></div>)}</div>;
}
