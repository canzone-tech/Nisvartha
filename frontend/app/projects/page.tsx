import Link from 'next/link';
import {publicMetadata} from '@/lib/metadata';
import {publishedProjects} from '@/lib/projects';
import {listPublishedCms} from '@/lib/cms-public';
export const metadata=publicMetadata('/projects','Projects','Published Foundation projects, objectives and progress.',false);
export default async function Projects(){
 const approved=await listPublishedCms('PROJECT');
 const projects=[...publishedProjects().map(p=>({slug:p.slug,title:p.title,summary:p.summary})),...approved];
 return <main id="main-content" className="page-shell">
  <div className="eyebrow">Community & Environment</div><h1>Our Projects</h1>
  <p className="page-lead">Verified initiatives and independently approved progress.</p>
  {projects.length===0?<section className="empty-state"><h2>Project updates are being reviewed</h2><p>There are no verified projects published yet.</p><Link href="/activities" className="text-link">Explore activities</Link></section>
   :<div className="project-grid">{projects.map(p=><article className="project-card" key={p.slug}>
    <h2>{p.title}</h2><p>{p.summary}</p><Link href={'/projects/'+p.slug} className="text-link">Read project details</Link>
   </article>)}</div>}
 </main>;
}
