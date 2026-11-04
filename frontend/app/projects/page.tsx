export const dynamic='force-dynamic';
import Link from 'next/link';
import {ClientPage} from '@/components/client-page';
import {publicMetadata} from '@/lib/metadata';
import {publishedProjects} from '@/lib/projects';
import {listPublishedCms} from '@/lib/cms-public';
export const metadata=publicMetadata('/projects','Our Projects','Published Foundation projects.',false);
export default async function Projects(){
 const approved=await listPublishedCms('PROJECT');
 const projects=[...publishedProjects().map(p=>({slug:p.slug,title:p.title,summary:p.summary})),...approved];
 return <ClientPage slug="projects">
  {projects.length>0&&<section className="section cms-extensions" aria-label="Approved project directory"><div className="container">
   <h2>Approved projects</h2><div className="grid">
    {projects.map(p=><article className="card" key={p.slug}><h3>{p.title}</h3><p>{p.summary}</p>
     <Link href={'/projects/'+p.slug}>Read project details</Link></article>)}
   </div>
  </div></section>}
 </ClientPage>;
}
