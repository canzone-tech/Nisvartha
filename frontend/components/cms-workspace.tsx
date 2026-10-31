'use client';
import {FormEvent,useCallback,useEffect,useState} from 'react';
type Role='ADMIN'|'EDITOR'|'APPROVER'|'AUDITOR';
type Revision={id:string;version:number;status:'DRAFT'|'SUBMITTED'|'APPROVED'|'REJECTED';authorId:string;title?:string;summary?:string;body?:string};
type Content={id:string;slug:string;kind:string;publishedRevisionId:string|null;archivedAt:string|null;revisions:Revision[]};
type Dashboard={drafts:number;submitted:number;published:number;newEnquiries:number;newVolunteerEnquiries:number};
const endpoint='/api/admin/backend/';
const kinds=['PAGE','ACTIVITY','PROJECT','NEWS','EVENT','FAQ'] as const;
async function api(path:string,method:'GET'|'POST'='GET',payload?:object){
 const response=await fetch(endpoint+path,{method,headers:payload?{'Content-Type':'application/json'}:undefined,body:payload?JSON.stringify(payload):undefined,cache:'no-store'});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw new Error(Array.isArray(data?.message)?data.message.join(', '):data?.message||'Request failed');
 return data;
}
export function CmsWorkspace({user}:{user:{id:string;role:Role}}){
 const [items,setItems]=useState<Content[]>([]);
 const [dashboard,setDashboard]=useState<Dashboard|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [editing,setEditing]=useState<string|null>(null),[kind,setKind]=useState<typeof kinds[number]>('PAGE');
 const [slug,setSlug]=useState(''),[title,setTitle]=useState(''),[summary,setSummary]=useState(''),[body,setBody]=useState('');
 const [reason,setReason]=useState('');
 const canEdit=user.role==='EDITOR'||user.role==='ADMIN';
 const canApprove=user.role==='APPROVER'||user.role==='ADMIN';
 const reload=useCallback(async()=>{
  const [content,stats]=await Promise.all([api('cms/contents'),api('cms/dashboard')]);
  setItems(content);setDashboard(stats);
 },[]);
 useEffect(()=>{void Promise.resolve().then(reload).catch(e=>setError(e instanceof Error?e.message:'Unable to load workspace'))},[reload]);
 async function action(name:string,path:string,payload?:object){
  setBusy(true);setError('');setMessage('');
  try{await api(path,'POST',payload);setMessage(name+' completed');await reload();return true;}
  catch(e){setError(e instanceof Error?e.message:'Action failed');return false;}
  finally{setBusy(false)}
 }
 function reset(){setEditing(null);setSlug('');setKind('PAGE');setTitle('');setSummary('');setBody('')}
 async function edit(item:Content){
  setError('');setMessage('');
  try{
   const detail=await api('cms/contents/'+item.id) as Content;
   const current=detail.revisions[0];
   if(!current)throw Error('No previous revision');
   setEditing(item.id);setSlug(item.slug);setKind(item.kind as typeof kinds[number]);setTitle(current.title||'');setSummary(current.summary||'');setBody(current.body||'');
   document.getElementById('cms-editor')?.scrollIntoView({behavior:'smooth'});
  }catch(e){setError(e instanceof Error?e.message:'Unable to edit')}
 }
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const path=editing?'cms/contents/'+editing+'/revisions':'cms/contents';
  const payload=editing?{title,summary,body}:{slug,kind,title,summary,body};
  if(await action(editing?'New revision':'New draft',path,payload))reset();
 }
 return <div className="cms-workspace">
  {dashboard&&<section className="cms-stats" aria-label="Content dashboard">
   <div><strong>{dashboard.drafts}</strong><span>Draft revisions</span></div>
   <div><strong>{dashboard.submitted}</strong><span>Pending reviews</span></div>
   <div><strong>{dashboard.published}</strong><span>Published pages</span></div>
   <div><strong>{dashboard.newEnquiries}</strong><span>New enquiries</span></div>
   <div><strong>{dashboard.newVolunteerEnquiries}</strong><span>Volunteer enquiries</span></div>
  </section>}
  {message&&<p role="status" className="admin-success">{message}</p>}
  {error&&<p role="alert" className="admin-error">{error}</p>}
  {canEdit&&<section id="cms-editor" className="admin-panel">
   <h2>{editing?'Create updated draft':'Create content draft'}</h2>
   <p>Draft text is not public. An independent approver must publish it.</p>
   <form className="admin-form" onSubmit={save}>
    {!editing&&<><label>Slug <input value={slug} onChange={e=>setSlug(e.target.value)} required maxLength={150} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="our-mission"/></label>
     <label>Content type <select value={kind} onChange={e=>setKind(e.target.value as typeof kinds[number])}>{kinds.map(x=><option value={x} key={x}>{x}</option>)}</select></label></>}
    <label>Title <input value={title} onChange={e=>setTitle(e.target.value)} minLength={3} maxLength={200} required/></label>
    <label>Summary <textarea value={summary} onChange={e=>setSummary(e.target.value)} maxLength={600}/></label>
    <label>Body (plain text) <textarea value={body} onChange={e=>setBody(e.target.value)} minLength={1} maxLength={20000} required rows={7}/></label>
    <div className="actions"><button className="button" type="submit" disabled={busy}>Save draft</button>{editing&&<button className="button alt" type="button" onClick={reset}>Cancel edit</button>}</div>
   </form>
  </section>}
  <section className="admin-panel"><h2>Content and approvals</h2>
   {items.length===0?<p>No content records yet. Editors can create the first draft.</p>:<div className="cms-list">{items.map(item=>{
    const rev=item.revisions[0];
    return <article key={item.id} className="cms-row">
     <div><p className="eyebrow">{item.kind} · {item.slug}</p><h3>{rev?.title||item.slug}</h3>
      <p>Latest version: {rev?.version||'–'} · {rev?.status||'–'} · {item.archivedAt?'Archived':item.publishedRevisionId?'Published':'Not public'}</p>
     </div>
     <div className="cms-row-actions">
      {canEdit&&rev?.status!=='SUBMITTED'&&!item.archivedAt&&<button disabled={busy} onClick={()=>void edit(item)}>New draft</button>}
      {canEdit&&rev&&['DRAFT','REJECTED'].includes(rev.status)&&<button disabled={busy} onClick={()=>void action('Submitted','cms/revisions/'+rev.id+'/submit',{})}>Submit for review</button>}
      {canApprove&&rev?.status==='SUBMITTED'&&rev.authorId!==user.id&&<button disabled={busy} onClick={()=>void action('Published','cms/revisions/'+rev.id+'/approve',{})}>Approve & publish</button>}
      {canApprove&&rev?.status==='SUBMITTED'&&rev.authorId!==user.id&&<button disabled={busy||reason.trim().length<8} onClick={()=>void action('Rejected','cms/revisions/'+rev.id+'/reject',{reason})}>Reject with reason</button>}
      {canApprove&&!item.archivedAt&&<button disabled={busy} onClick={()=>void action('Archived','cms/contents/'+item.id+'/archive',{})}>Archive</button>}
     </div>
    </article>;
   })}</div>}
   {canApprove&&<label className="admin-reason">Rejection reason (minimum 8 characters) <textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={1000}/></label>}
  </section>
 </div>;
}
