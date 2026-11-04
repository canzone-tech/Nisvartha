export const dynamic='force-dynamic';
import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {ClientPage} from '@/components/client-page';
import {clientPageContent} from '@/lib/client-content';
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
 return publicMetadata('/'+section,cms?.title||fallback.title,cms?.summary||fallback.description,
  Boolean(cms)||fallback.publication==='INFORMATIONAL');
}
export default async function Page({params}:Props){
 const {section}=await params;
 const fallback=pageBySlug.get(section);
 if(!fallback)notFound();
 const cms=await approvedPage(section);
 const isEnquiry=section==='contact'||section==='volunteer';
 const liveEnquiries=isEnquiry&&process.env.NEXT_PUBLIC_FORMS_ENABLED==='true'&&
  process.env.NEXT_PUBLIC_PRIVACY_APPROVED==='true';
 const clientCopy=clientPageContent(section);
 if(clientCopy!==null){
  return <ClientPage slug={section} liveEnquiries={liveEnquiries}>
   {cms&&<section className="section cms-extensions" aria-label="Approved editorial update"><div className="container">
    <h2>{cms.title}</h2><p>{cms.summary}</p><p className="cms-copy">{cms.body}</p>
   </div></section>}
   {liveEnquiries&&<section className="section cms-extensions" aria-label="Official enquiry form"><div className="container">
    {process.env.NISVARTHA_UAT_FORMS==='synthetic'&&<p role="status">
      Synthetic local UAT only. Enter fake example.invalid details; the official test form stores a record in the disposable database.
    </p>}
    <EnquiryForm kind={section as 'contact'|'volunteer'}/>
   </div></section>}
  </ClientPage>;
 }
 // Accessibility is outside the client's 18-page source; preserve the
 // existing approved fallback and page-specific CMS publication behavior.
 return <main id="main-content">
  <div className="eyebrow">Nisvartha Foundation</div>
  <h1>{cms?.title||fallback.title}</h1>
  <p className="page-lead">{cms?.summary||fallback.lead}</p>
  {cms?<section className="content-section"><p className="cms-copy">{cms.body}</p></section>
   :<>{fallback.sections.map(s=><section className="content-section" key={s.title}>
    <h2>{s.title}</h2><p>{s.body}</p></section>)}</>}
 </main>;
}
