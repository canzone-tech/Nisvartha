import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import Link from 'next/link';
import {getPublishedProject,publishedProjects} from '@/lib/projects';
type Props={params:Promise<{slug:string}>};
export function generateStaticParams(){return publishedProjects().map(p=>({slug:p.slug}));}
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {slug}=await params;const project=getPublishedProject(slug);
 if(!project)return {title:'Project not found',robots:{index:false,follow:false}};
 return {title:project.title,description:project.summary,robots:{index:false,follow:false}};
}
export default async function ProjectDetail({params}:Props){
 const {slug}=await params;const project=getPublishedProject(slug);
 if(!project)notFound();
 return <main id="main-content" className="page-shell">
  <Link href="/projects" className="text-link">Back to projects</Link>
  <p className="eyebrow">{project.category.replace('_',' ')}</p>
  <h1>{project.title}</h1><p className="page-lead">{project.summary}</p>
  <section className="content-section"><h2>Project objectives</h2>
   <ul>{project.objectives.map(o=><li key={o}>{o}</li>)}</ul></section>
  <section className="content-section"><h2>Progress and status</h2>
   <p>{project.progress}</p><p>Status: {project.status.replaceAll('_',' ').toLowerCase()}</p>
   {project.location&&<p>Location: {project.location}</p>}
   {project.startDate&&<p>Started: {project.startDate}</p>}
   {project.endDate&&<p>Ended: {project.endDate}</p>}
  </section>
  {project.outcomes?.length&&<section className="content-section"><h2>Verified outcomes</h2><ul>{project.outcomes.map(o=><li key={o}>{o}</li>)}</ul></section>}
 </main>;
}
