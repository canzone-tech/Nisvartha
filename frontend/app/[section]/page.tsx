import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {pageBySlug} from '@/lib/site';
import {publicMetadata} from '@/lib/metadata';
import {EnquiryForm} from '@/components/enquiry-form';
type Props={params:Promise<{section:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{const {section}=await params;const p=pageBySlug.get(section);if(!p)return {title:'Not found',robots:{index:false,follow:false}};return publicMetadata('/'+section,p.title,p.description,p.publication==='INFORMATIONAL');}
export default async function Page({params}:Props){const {section}=await params;const p=pageBySlug.get(section);if(!p)notFound();return <main id="main-content"><div className="eyebrow">Nisvartha Foundation</div><h1>{p.title}</h1><p className="page-lead">{p.lead}</p><p className="review-notice">{p.publication==='PENDING'?'Content awaiting authorized approval.':'Information subject to verification.'}</p>{p.sections.map(s=><section className="content-section" key={s.title}><h2>{s.title}</h2><p>{s.body}</p></section>)}{(section==='contact'||section==='volunteer')&&<EnquiryForm kind={section}/>}</main>}
