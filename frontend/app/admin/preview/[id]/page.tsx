import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {staffFetch} from '@/lib/staff-session';

export const dynamic='force-dynamic';
export const metadata:Metadata={
 title:'Staff-only content preview | Nisvartha Foundation',
 robots:{index:false,follow:false,noarchive:true,nosnippet:true}
};
type EventState='SCHEDULED'|'POSTPONED'|'CANCELLED'|'COMPLETED';
type RevisionPreview={
 id:string;version:number;status:'DRAFT'|'SUBMITTED'|'APPROVED'|'REJECTED';
 title:string;summary:string;body:string;createdAt:string;
 eventStartAt:string|null;eventEndAt:string|null;eventTimezone:string|null;
 eventVenue:string|null;eventOnlineUrl:string|null;eventRegistrationUrl:string|null;
 eventLifecycle:EventState|null;reviewReason:string|null;isPublished:boolean;
 content:{id:string;slug:string;kind:string;archivedAt:string|null;publishedRevisionId:string|null};
};
function eventTime(value:string|null,timeZone:string|null){
 if(!value)return null;
 try{return new Intl.DateTimeFormat('en-IN',{
  dateStyle:'medium',timeStyle:'short',timeZone:timeZone||'UTC'
 }).format(new Date(value));}
 catch{return 'Invalid stored time'}
}
export default async function PreviewPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/.test(id))notFound();
 const result=await staffFetch('cms/revisions/'+id+'/preview');
 if(result.status===401)redirect('/admin/login');
 if(result.status===404)notFound();
 if(result.status===403)throw new Error('Staff permission required to preview this revision');
 if(!result.ok)throw new Error('Unable to load staff preview');
 const preview=await result.json() as RevisionPreview;
 return <main id="main-content" className="page-shell cms-preview-page">
  <p><Link href="/admin" className="text-link">Back to staff workspace</Link></p>
  <aside className="admin-policy" aria-label="Private preview notice">
   <strong>Internal preview — not public.</strong> This is a stored revision, not the published page.
   Approval is required before an unpublished version can appear on the website.
  </aside>
  <p className="eyebrow">{preview.content.kind} · {preview.content.slug}</p>
  <h1>{preview.title}</h1>
  <p className="page-lead">{preview.summary}</p>
  <dl className="cms-preview-meta">
   <div><dt>Revision</dt><dd>#{preview.version}</dd></div>
   <div><dt>Review status</dt><dd>{preview.status.toLowerCase()}</dd></div>
   <div><dt>Public status</dt><dd>{preview.isPublished?'Currently published':preview.content.archivedAt?'Archived — not public':'Not published'}</dd></div>
  </dl>
  {preview.reviewReason&&<p className="review-notice"><strong>Reviewer feedback:</strong> {preview.reviewReason}</p>}
  {preview.content.kind==='EVENT'&&<section className="content-section">
   <h2>Event information in this revision</h2>
   <p><strong>Lifecycle:</strong> {preview.eventLifecycle||'Unspecified'}</p>
   {preview.eventStartAt&&<p><strong>Starts:</strong> {eventTime(preview.eventStartAt,preview.eventTimezone)} ({preview.eventTimezone||'UTC'})</p>}
   {preview.eventEndAt&&<p><strong>Ends:</strong> {eventTime(preview.eventEndAt,preview.eventTimezone)}</p>}
   {preview.eventVenue&&<p><strong>Venue:</strong> {preview.eventVenue}</p>}
   {preview.eventOnlineUrl&&<p><strong>Online URL:</strong> {preview.eventOnlineUrl}</p>}
   {preview.eventRegistrationUrl&&<p><strong>Registration URL:</strong> {preview.eventRegistrationUrl}</p>}
  </section>}
  <section className="content-section"><h2>Revision body</h2>
   <p className="cms-copy">{preview.body}</p>
  </section>
  <p className="review-notice">Plain-text content is escaped by React. The preview does not enable payment, registration or external publication.</p>
 </main>;
}
