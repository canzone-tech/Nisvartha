export const dynamic = 'force-dynamic';
import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {pageBySlug} from '@/lib/site';
import {publicMetadata} from '@/lib/metadata';
import {getPublishedCms} from '@/lib/cms-public';
import {EnquiryForm} from '@/components/enquiry-form';
type Props={params:Promise<{section:string}>};
const cmsPages=new Set(['about','how-it-works','accessibility']);
async function approvedPage(slug:string){
 if(!cmsPages.has(slug))return null;
 const content=await getPublishedCms(slug);
 return content?.kind==='PAGE'?content:null;
}
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {section}=await params;
 const fallback=pageBySlug.get(section);
 if(!fallback)return {title:'Not found',robots:{index:false,follow:false}};
 const cms=await approvedPage(section);
 return publicMetadata('/'+section,cms?.title||fallback.title,cms?.summary||fallback.description,Boolean(cms)||fallback.publication==='INFORMATIONAL');
}
export default async function Page({params}:Props){
 const {section}=await params;
 const fallback=pageBySlug.get(section);
 if(!fallback)notFound();
 const cms=await approvedPage(section);
 return <main id="main-content">
  <div className="eyebrow">Nisvartha Foundation</div>
  <h1>{cms?.title||fallback.title}</h1>
  <p className="page-lead">{cms?.summary||fallback.lead}</p>
  {cms?<section className="content-section"><p className="cms-copy">{cms.body}</p></section>
  :<><p className="review-notice">{fallback.publication==='PENDING'?'Content awaiting authorized approval.':'Information subject to verification.'}</p>
    {fallback.sections.map(s=><section className="content-section" key={s.title}><h2>{s.title}</h2><p>{s.body}</p></section>)}</>}
  {(section==='contact'||section==='volunteer')&&<EnquiryForm kind={section}/>}
 </main>;
}
