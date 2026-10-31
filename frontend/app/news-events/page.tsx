export const dynamic = 'force-dynamic';
import {publicMetadata} from '@/lib/metadata';
import {publishedAnnouncements} from '@/lib/publications';
import {listPublishedCms} from '@/lib/cms-public';
export const metadata=publicMetadata('/news-events','News & Events','Published Foundation news and events.',false);
export default async function NewsEvents(){
 const published=await Promise.all([listPublishedCms('NEWS'),listPublishedCms('EVENT')]);
 const items=[...publishedAnnouncements().map(a=>({slug:a.slug,title:a.title,summary:a.summary,kind:a.kind})),...published.flat()];
 return <main id="main-content" className="page-shell">
  <p className="eyebrow">Updates</p><h1>News & Events</h1><p className="page-lead">Only verified announcements and approved details appear here.</p>
  {items.length===0?<div className="empty-state"><h2>No published updates yet</h2><p>Announcements are under editorial review.</p></div>
   :<div className="project-grid">{items.map(item=><article className="project-card" key={item.slug}><p className="eyebrow">{item.kind}</p><h2>{item.title}</h2><p>{item.summary}</p></article>)}</div>}
 </main>;
}
