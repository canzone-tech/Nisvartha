import {notFound} from 'next/navigation';
import {pageBySlug} from '@/lib/site';
export default async function Page({params}:{params:Promise<{section:string}>}){const {section}=await params;const p=pageBySlug.get(section);if(!p)notFound();return <main id="main-content"><h1>{p.title}</h1><p>{p.lead}</p><p>Information is subject to approval.</p>{p.sections.map(s=><section key={s.title}><h2>{s.title}</h2><p>{s.body}</p></section>)}</main>}
