'use client';
import {useCallback,useEffect,useState} from 'react';
type EnquirySummary={id:string;reference:string;category:'CONTACT'|'VOLUNTEER';status:string;assignedToId:string|null;legalHoldAt:string|null;archivedAt:string|null;createdAt:string};
type EnquiryDetail=EnquirySummary&{name:string;email:string;subject:string;message:string;interests:string|null;availability:string|null;privacyVersion:string;notes:{id:string;body:string;authorId:string;createdAt:string}[]};
async function api(path:string,method:'GET'|'POST'='GET',payload?:object){
 const res=await fetch('/api/admin/backend/cms/enquiries'+path,{method,headers:payload?{'Content-Type':'application/json'}:undefined,body:payload?JSON.stringify(payload):undefined,cache:'no-store'});
 const json=await res.json().catch(()=>null);
 if(!res.ok)throw Error(Array.isArray(json?.message)?json.message.join(', '):json?.message||'Enquiry operation failed');
 return json;
}
export function EnquiryCasePanel({user}:{user:{id:string;role:'ADMIN'|'APPROVER'}}){
 const [list,setList]=useState<EnquirySummary[]>([]),[selected,setSelected]=useState<EnquiryDetail|null>(null);
 const [note,setNote]=useState(''),[reason,setReason]=useState(''),[feedback,setFeedback]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const reload=useCallback(async()=>setList(await api('/') as EnquirySummary[]),[]);
 useEffect(()=>{void Promise.resolve().then(reload).catch(e=>setError(e instanceof Error?e.message:'Unable to load enquiries'))},[reload]);
 const view=async(id:string)=>{try{setError('');setSelected(await api('/'+id) as EnquiryDetail)}catch(e){setError(e instanceof Error?e.message:'Unable to view case')}};
 async function change(path:string,data:object,message:string){
  setBusy(true);setError('');setFeedback('');
  try{await api(path,'POST',data);setFeedback(message);await reload();if(selected)await view(selected.id);return true}
  catch(e){setError(e instanceof Error?e.message:'Unable to update case');return false}
  finally{setBusy(false)}
 }
 async function exportData(){
  try{
   const result=await api('/export');
   const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'});
   const url=URL.createObjectURL(blob);
   const anchor=document.createElement('a');anchor.href=url;anchor.download='nisvartha-enquiries-authorized.json';anchor.click();
   URL.revokeObjectURL(url);
   setFeedback('Export recorded in the audit log. Keep the downloaded personal data secure.');
  }catch(e){setError(e instanceof Error?e.message:'Export unavailable')}
 }
 async function retention(){
  if(!window.confirm('Apply the APPROVED retention policy? Eligible personal data and staff notes will be irreversibly anonymized. Legal holds remain protected.'))return;
  await change('/retention/run',{},'Retention operation recorded');
 }
 const statusOptions=selected?.category==='CONTACT'?['NEW','IN_REVIEW','CLOSED']:['NEW','IN_REVIEW','CONTACTED','ACCEPTED','DECLINED','WITHDRAWN'];
 return <section className="admin-panel"><h2>Contact & volunteer enquiries</h2>
  <p>Only authorized handlers can access personal submissions. Detail reads, exports and changes are audited.</p>
  {feedback&&<p role="status" className="admin-success">{feedback}</p>}
  {error&&<p role="alert" className="admin-error">{error}</p>}
  {user.role==='ADMIN'&&<div className="actions"><button type="button" className="button alt" onClick={()=>void exportData()}>Export authorized records</button>
   <button type="button" className="button alt" onClick={()=>void retention()}>Apply approved retention</button></div>}
  <div className="cms-list">{list.map(item=><article className="cms-row" key={item.id}>
   <div><strong>{item.reference}</strong><p>{item.category} · {item.status} · {new Date(item.createdAt).toLocaleDateString()}</p><p>Assignee: {item.assignedToId||'Unassigned'}{item.legalHoldAt?' · Legal hold':''}</p></div>
   <div className="cms-row-actions"><button type="button" onClick={()=>void view(item.id)}>Open case</button></div>
  </article>)}</div>
  {selected&&<section className="admin-case-detail">
   <h3>Case {selected.reference}</h3>
   <p>Name: {selected.name} · Email: {selected.email}</p><p>Subject: {selected.subject}</p><p className="cms-copy">{selected.message}</p>
   {selected.interests&&<p>Interests: {selected.interests}</p>}{selected.availability&&<p>Availability: {selected.availability}</p>}
   <p>Consent notice version: {selected.privacyVersion}</p>
   <div className="cms-row-actions">
    <button type="button" disabled={busy} onClick={()=>void change('/'+selected.id+'/assign',{staffId:user.id},'Assigned to your account')}>Assign to me</button>
    {statusOptions.map(status=><button key={status} type="button" disabled={busy||selected.status===status} onClick={()=>void change('/'+selected.id+'/status',{status},'Case status updated')}>{status.replaceAll('_',' ')}</button>)}
   </div>
   <label className="admin-reason">Internal note <textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={2000}/></label>
   <button type="button" className="button" disabled={busy||note.trim().length<2} onClick={async()=>{if(await change('/'+selected.id+'/notes',{note},'Internal note recorded'))setNote('')}}>Add internal note</button>
   <h4>Private staff notes</h4><ul>{selected.notes.map(n=><li key={n.id}>{n.body} <small>({new Date(n.createdAt).toLocaleString()})</small></li>)}</ul>
   {user.role==='ADMIN'&&<><label className="admin-reason">Legal-hold reason <textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={300}/></label>
    <button type="button" className="button alt" disabled={busy||reason.trim().length<8} onClick={()=>void change('/'+selected.id+'/legal-hold',{enabled:!selected.legalHoldAt,reason},selected.legalHoldAt?'Hold released':'Hold applied')}>{selected.legalHoldAt?'Release legal hold':'Place legal hold'}</button></>}
  </section>}
 </section>;
}
