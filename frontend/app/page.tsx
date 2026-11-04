import Link from 'next/link';
import {ClientPage} from '@/components/client-page';
import {publicMetadata} from '@/lib/metadata';
import {publishedActivities,publishedAnnouncements} from '@/lib/publications';
import {publishedProjects} from '@/lib/projects';
export const metadata=publicMetadata('/','Home','Nisvartha Foundation: community and environmental participation.',true);
export default function Home(){
 const projects=publishedProjects().slice(0,3);
 const activities=publishedActivities().slice(0,3);
 const news=publishedAnnouncements().slice(0,2);
 return <ClientPage slug="index">
  {projects.length>0&&<section className="section cms-extensions"><div className="container">
   <h2>Featured projects</h2><div className="grid">
    {projects.map(p=><article className="card" key={p.slug}>
     <h3>{p.title}</h3><p>{p.summary}</p>
     <Link href={'/projects/'+p.slug}>View details</Link>
    </article>)}
   </div></div></section>}
  {activities.length>0&&<section className="section cms-extensions"><div className="container">
   <h2>Recent activities</h2><div className="grid">
    {activities.map(a=><article className="card" key={a.slug}>
     <h3>{a.title}</h3><p>{a.summary}</p>
    </article>)}
   </div></div></section>}
  {news.length>0&&<section className="section cms-extensions"><div className="container">
   <h2>News &amp; events</h2><div className="grid">
    {news.map(n=><article className="card" key={n.slug}>
     <h3>{n.title}</h3><p>{n.summary}</p>
    </article>)}
   </div></div></section>}
 </ClientPage>;
}
