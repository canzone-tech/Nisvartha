export const dynamic = 'force-dynamic';
import {publicMetadata} from '@/lib/metadata';
import {publishedAnnouncements} from '@/lib/publications';
import {listPublishedCms} from '@/lib/cms-public';
import type {PublishedCmsSummary} from '@/lib/cms-public';
export const metadata=publicMetadata('/news-events','News & Events','Published Foundation news and events.',false);
function eventDate(value:string|null|undefined,timezone:string|null|undefined){
 if(!value)return null;
 const parsed=new Date(value);
 if(!Number.isFinite(parsed.getTime()))return null;
 try{return new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:timezone||'UTC'}).format(parsed)}
 catch{return null}
}
export default async function NewsEvents(){
 const published=await Promise.all([listPublishedCms('NEWS'),listPublishedCms('EVENT')]);
 const items:PublishedCmsSummary[]=[...publishedAnnouncements().map(a=>({slug:a.slug,title:a.title,summary:a.summary,kind:a.kind})),...published.flat()];
 return <main id="main-content" className="page-shell">
  <p className="eyebrow">Updates</p><h1>News & Events</h1><p className="page-lead">Only verified announcements and approved details appear here.</p>
  {items.length===0?<div className="empty-state"><h2>No published updates yet</h2><p>Announcements are under editorial review.</p></div>
   :<div className="project-grid">{items.map(item=><article className="project-card" key={item.slug}>
    <p className="eyebrow">{item.kind}{item.kind==='EVENT'&&item.eventLifecycle?' · '+item.eventLifecycle.toLowerCase():''}</p>
    <h2>{item.title}</h2><p>{item.summary}</p>
    {item.kind==='EVENT'&&<div className="event-detail">
     {item.eventStartAt&&<p><strong>Starts:</strong> {eventDate(item.eventStartAt,item.eventTimezone)} ({item.eventTimezone})</p>}
     {item.eventEndAt&&<p><strong>Ends:</strong> {eventDate(item.eventEndAt,item.eventTimezone)}</p>}
     {item.eventVenue&&<p><strong>Venue:</strong> {item.eventVenue}</p>}
     {item.eventOnlineUrl&&<p><a href={item.eventOnlineUrl} rel="noopener noreferrer">Online event details</a></p>}
     {item.eventRegistrationUrl&&item.eventLifecycle!=='CANCELLED'&&<p><a href={item.eventRegistrationUrl} rel="noopener noreferrer">Registration details</a></p>}
    </div>}
   </article>)}</div>}
 </main>;
}
