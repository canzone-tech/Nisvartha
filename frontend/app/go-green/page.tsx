import type {Metadata} from 'next';
import Link from 'next/link';
import {goGreenActivities} from '@/lib/publications';
export const metadata:Metadata={title:'Go Green',description:'Verified environmental initiatives and campaigns.',robots:{index:false,follow:false}};
export default function GoGreen(){
 const items=goGreenActivities();
 return <main id="main-content" className="page-shell">
  <p className="eyebrow">Environment</p><h1>Go Green</h1>
  <p className="page-lead">Environmental activities, plantation campaigns and evidence-backed outcomes are published after review.</p>
  {items.length===0?<section className="empty-state"><h2>Campaign information pending verification</h2><p>There are no approved campaigns available yet. No plantation totals, locations or impact figures are claimed.</p><Link href="/activities" className="text-link">Other activities</Link></section>
   :<div className="project-grid">{items.map(item=><article className="project-card" key={item.slug}><h2>{item.title}</h2><p>{item.summary}</p>{item.occurredAt&&<p>Date: {item.occurredAt}</p>}{item.location&&<p>Location: {item.location}</p>}{item.outcome&&<p>Verified outcome: {item.outcome}</p>}</article>)}</div>}
 </main>;
}
