export const dynamic = 'force-dynamic';
import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import Link from 'next/link';
import {getPublishedProject,publishedProjects} from '@/lib/projects';
import {getPublishedCms} from '@/lib/cms-public';
import {publicMetadata} from '@/lib/metadata';
type Props={params:Promise<{slug:string}>};
export function generateStaticParams(){return publishedProjects().map(p=>({slug:p.slug}));}
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {slug}=await params;const staticProject=getPublishedProject(slug);
 const cms=staticProject?null:await getPublishedCms(slug);
 const project=cms?.kind==='PROJECT'?cms:staticProject;
 if(!project)return {title:'Project not found',robots:{index:false,follow:false}};
 return publicMetadata('/projects/'+slug,project.title,project.summary,true);
}
export default async function ProjectDetail({params}:Props){
 const {slug}=await params;const staticProject=getPublishedProject(slug);
 const cms=staticProject?null:await getPublishedCms(slug);
 if(!staticProject&&cms?.kind!=='PROJECT')notFound();
 const project=staticProject||cms!;
 return <main id="main-content" className="page-shell">
  <Link href="/projects" className="text-link">Back to projects</Link>
  <p className="eyebrow">Approved project</p><h1>{project.title}</h1><p className="page-lead">{project.summary}</p>
  {staticProject?<><section className="content-section"><h2>Objectives</h2><ul>{staticProject.objectives.map(o=><li key={o}>{o}</li>)}</ul></section>
   <section className="content-section"><h2>Progress</h2><p>{staticProject.progress}</p></section></>
   :<section className="content-section"><h2>Project information</h2><p className="cms-copy">{cms!.body}</p></section>}
 </main>;
}
