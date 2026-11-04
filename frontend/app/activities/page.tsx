export const dynamic='force-dynamic';
import {ClientPage} from '@/components/client-page';
import {publicMetadata} from '@/lib/metadata';
import {publishedActivities} from '@/lib/publications';
import {listPublishedCms} from '@/lib/cms-public';
export const metadata=publicMetadata('/activities','Our Activities','Published Foundation activities.',false);
export default async function Activities(){
 const fromCms=await listPublishedCms('ACTIVITY');
 const activities=[...publishedActivities().map(a=>({slug:a.slug,title:a.title,summary:a.summary})),...fromCms];
 return <ClientPage slug="activities">
  {activities.length>0&&<section className="section cms-extensions" aria-label="Published activities"><div className="container">
   <h2>Published activities</h2><div className="grid">
    {activities.map(a=><article className="card" key={a.slug}><h3>{a.title}</h3><p>{a.summary}</p></article>)}
   </div>
  </div></section>}
 </ClientPage>;
}
