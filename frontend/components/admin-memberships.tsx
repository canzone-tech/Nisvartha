'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
type Application={
 id:string;status:'SUBMITTED'|'UNDER_REVIEW'|'APPROVED'|'REJECTED'|'SUSPENDED'|'WITHDRAWN';
 createdAt:string;termsVersion:string;privacyVersion:string;decisionReason:string|null;
 member:{id:string;email:string;displayName:string;status:string};
};
type ReviewFilter='ALL'|Application['status'];
type ReviewPage={items:Application[];nextCursor:string|null};
const REVIEW_STATUSES:ReviewFilter[]=['ALL','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','SUSPENDED','WITHDRAWN'];
export function MembershipReviewPanel(){
 const [rows,setRows]=useState<Application[]>([]);
 const [reason,setReason]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [filter,setFilter]=useState<ReviewFilter>('ALL');
 const [nextCursor,setNextCursor]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const requestSequence=useRef(0);
 const reload=useCallback(async(status:ReviewFilter,cursor:string|null,append:boolean)=>{
  const requestId=++requestSequence.current;
  setLoading(true);setError('');
  const params=new URLSearchParams({limit:'25'});
  if(status!=='ALL')params.set('status',status);
  if(cursor)params.set('cursor',cursor);
  try{
   const response=await fetch('/api/admin/backend/cms/membership/applications/page?'+params.toString(),{cache:'no-store'});
   if(!response.ok)throw Error('Unable to load applications');
   const data=await response.json() as ReviewPage;
   if(!Array.isArray(data.items)||data.items.length>25||
      (data.nextCursor!==null&&typeof data.nextCursor!=='string'))
    throw Error('Unexpected review queue response');
   if(requestId!==requestSequence.current)return;
   setRows(previous=>append?[...previous,...data.items]:data.items);
   setNextCursor(data.nextCursor);
  }catch(e){
   if(requestId!==requestSequence.current)return;
   setError(e instanceof Error?e.message:'Membership review unavailable');
   if(!append){setRows([]);setNextCursor(null)}
  }finally{if(requestId===requestSequence.current)setLoading(false)}
 },[]);
 useEffect(()=>{void Promise.resolve().then(()=>reload('ALL',null,false))},[reload]);
 async function perform(id:string,operation:'review'|'decide',status?:'APPROVED'|'REJECTED'|'SUSPENDED'){
  setBusy(true);setError('');setNotice('');
  try{
   const res=await fetch('/api/admin/backend/cms/membership/applications/'+id+'/'+operation,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(status?{status,reason}:{})
   });
   const result=await res.json().catch(()=>null);
   if(!res.ok)throw Error(result?.message||'Review action rejected');
   setNotice('Application review recorded in the Foundation audit log');
   await reload(filter,null,false);
  }catch(e){setError(e instanceof Error?e.message:'Review failed')}
  finally{setBusy(false)}
 }
 return <section className="admin-panel">
  <h2>Membership applications — nonfinancial</h2>
  <p>Review identity/application eligibility only. Approval does not issue E-PINs, create genealogy positions, accept funds or grant earnings.</p>
  {error&&<p role="alert" className="admin-error">{error}</p>}
  {notice&&<p role="status" className="admin-success">{notice}</p>}
  <label className="admin-reason">Application status
   <select value={filter} disabled={loading} onChange={event=>{
    const selected=event.target.value as ReviewFilter;
    setFilter(selected);
    void reload(selected,null,false);
   }}>
    {REVIEW_STATUSES.map(item=><option key={item} value={item}>{item==='ALL'?'All statuses':item.replaceAll('_',' ')}</option>)}
   </select>
  </label>
  <p role="status">{loading?'Loading applications…':rows.length+' applications shown'}{nextCursor?' · More available':''}</p>
  <label className="admin-reason">Decision reason (minimum 8 characters)<textarea maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
  {rows.length===0?<p>No applications to review.</p>:<div className="cms-list">{rows.map(item=>
   <article key={item.id} className="cms-row">
    <div><strong>{item.member.displayName}</strong><p>{item.member.email}</p>
     <p>Status: {item.status} · Account: {item.member.status}</p>
     <p>Terms: {item.termsVersion} · Privacy: {item.privacyVersion}</p>
     {item.decisionReason&&<p>Previous decision reason: {item.decisionReason}</p>}
    </div>
    <div className="cms-row-actions">
     {item.status==='SUBMITTED'&&<button disabled={busy} onClick={()=>void perform(item.id,'review')}>Start review</button>}
     {item.status==='UNDER_REVIEW'&&<>
      <button disabled={busy||reason.trim().length<8} onClick={()=>void perform(item.id,'decide','APPROVED')}>Approve</button>
      <button disabled={busy||reason.trim().length<8} onClick={()=>void perform(item.id,'decide','REJECTED')}>Reject</button>
     </>}
     {item.status==='APPROVED'&&<button disabled={busy||reason.trim().length<8} onClick={()=>void perform(item.id,'decide','SUSPENDED')}>Suspend</button>}
    </div>
   </article>)}</div>}
  {nextCursor&&<button className="button" type="button" disabled={loading||busy}
    onClick={()=>void reload(filter,nextCursor,true)}>Load more applications</button>}
 </section>;
}
