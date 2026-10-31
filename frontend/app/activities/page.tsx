import Link from 'next/link';
import {publicMetadata} from '@/lib/metadata';
import {publishedActivities} from '@/lib/publications';
export const metadata=publicMetadata("/activities","Activities","Published Nisvartha Foundation activities.",false);
export default function Activities(){
 const items=publishedActivities();
 return <main id="main-content" className="page-shell">
  <p className="eyebrow">Community initiatives</p><h1>Our Activities</h1>
  <p className="page-lead">Explore approved programme activities, verified descriptions and updates.</p>
  {items.length===0?<div className="empty-state"><h2>Activity updates are being reviewed</h2><p>No activity reports are ready for public publication yet.</p><Link href="/volunteer" className="text-link">Learn about volunteering</Link></div>
   :<div className="project-grid">{items.map(item=><article className="project-card" key={item.slug}><span className="eyebrow">{item.category.replace('_',' ')}</span><h2>{item.title}</h2><p>{item.summary}</p>{item.location&&<p>Location: {item.location}</p>}{item.outcome&&<p>Outcome: {item.outcome}</p>}</article>)}</div>}
 </main>;
}
