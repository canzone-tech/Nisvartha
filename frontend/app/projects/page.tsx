import Link from 'next/link';
import type {Metadata} from 'next';
import {publishedProjects} from '@/lib/projects';
export const metadata:Metadata={title:'Projects',description:'Published Foundation projects, objectives and progress.',robots:{index:false,follow:false}};
export default function Projects(){
 const projects=publishedProjects();
 return <main id="main-content" className="page-shell">
  <div className="eyebrow">Community & Environment</div>
  <h1>Our Projects</h1>
  <p className="page-lead">Verified initiatives and published progress. Dates, outcomes and partners are shown only when approved.</p>
  {projects.length===0
   ? <section className="empty-state" aria-label="Project publication status"><h2>Project updates are being reviewed</h2><p>There are no verified projects published yet. Please check back for approved updates.</p><Link href="/activities" className="text-link">Explore activities</Link></section>
   : <div className="project-grid">{projects.map(p=><article className="project-card" key={p.slug}>
      <span className="eyebrow">{p.category.replace('_',' ')}</span>
      <h2>{p.title}</h2><p>{p.summary}</p><p className="project-meta">Status: {p.status.replaceAll('_',' ').toLowerCase()}</p>
      <Link href={'/projects/'+p.slug} className="text-link">Read project details</Link>
    </article>)}</div>}
 </main>;
}
