import {publicMetadata} from '@/lib/metadata';
import {publishedAnnouncements} from '@/lib/publexport const metadata=publicMetadata('/news-events','News & Events','Published Foundation news and events.',false);
export default function NewsEvents(){
 const items=publishedAnnouncements();
 return <main id="main-content" className="page-shell">
  <p className="eyebrow">Updates</p><h1>News & Events</h1>
  <p className="page-lead">Only verified announcements, dates and event information appear here.</p>
  {items.length===0?<div className="empty-state"><h2>No published updates yet</h2><p>Announcements are under editorial review.</p></div>
   :<div className="project-grid">{items.map(item=><article className="project-card" key={item.slug}><p className="eyebrow">{item.kind}{item.archived?' · Archived':''}</p><h2>{item.title}</h2><p>{item.summary}</p>{item.startsAt&&<p>Starts: {item.startsAt} {item.timezone||''}</p>}{item.venue&&<p>Venue: {item.venue}</p>}{item.registrationUrl&&<a href={item.registrationUrl} rel="noopener noreferrer">Registration details</a>}</article>)}</div>}
 </main>;
}
