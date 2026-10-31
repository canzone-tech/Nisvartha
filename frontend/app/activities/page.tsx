export const dynamic = 'force-dynamic';
import Link from 'next/link';
import {publicMetadata} from '@/lib/metadata';
import {publishedActivities} from '@/lib/publications';
import {listPublishedCms} from '@/lib/cms-public';
export const metadata=publicMetadata('/activities','Activities','Published Nisvartha Foundation activities.',false);
export default async function Activities(){
 const fromCms=await listPublishedCms('ACTIVITY');
 const activities=[...publishedActivities().map(a=>({slug:a.slug,title:a.title,summary:a.summary})),...fromCms];
 return <main id="main-content" className="page-shell">
  <p className="eyebrow">Community initiatives</p><h1>Our Activities</h1><p className="page-lead">Approved programme activities and verified updates.</p>
  {activities.length===0?<div className="empty-state"><h2>Activity updates are being reviewed</h2><p>No verified activity reports are published yet.</p><Link href="/volunteer" className="text-link">Learn about volunteering</Link></div>
   :<div className="project-grid">{activities.map(a=><article className="project-card" key={a.slug}><h2>{a.title}</h2><p>{a.summary}</p></article>)}</div>}
 </main>;
}
