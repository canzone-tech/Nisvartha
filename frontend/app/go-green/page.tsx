import {ClientPage} from '@/components/client-page';
import {publicMetadata} from '@/lib/metadata';
import {goGreenActivities} from '@/lib/publications';
export const metadata=publicMetadata('/go-green','Go Green Initiative','Verified environmental initiatives.',false);
export default function GoGreen(){
 const items=goGreenActivities();
 return <ClientPage slug="go-green">
  {items.length>0&&<section className="section cms-extensions"><div className="container">
   <h2>Approved environmental campaigns</h2><div className="grid">
    {items.map(item=><article className="card" key={item.slug}>
     <h3>{item.title}</h3><p>{item.summary}</p>
     {item.occurredAt&&<p>Date: {item.occurredAt}</p>}
     {item.location&&<p>Location: {item.location}</p>}
     {item.outcome&&<p>Verified outcome: {item.outcome}</p>}
    </article>)}
   </div>
  </div></section>}
 </ClientPage>;
}
