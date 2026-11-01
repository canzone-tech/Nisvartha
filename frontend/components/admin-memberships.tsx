'use client';
import {useCallback,useEffect,useState} from 'react';
type Application={
 id:string;status:'SUBMITTED'|'UNDER_REVIEW'|'APPROVED'|'REJECTED'|'SUSPENDED'|'WITHDRAWN';
 createdAt:string;termsVersion:string;privacyVersion:string;decisionReason:string|null;
 member:{id:string;email:string;displayName:string;status:string};
};
export function MembershipReviewPanel(){
 const [rows,setRows]=useState<Application[]>([]);
 const [reason,setReason]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const reload=useCallback(async()=>{
  const response=await fetch('/api/admin/backend/cms/membership/applications',{cache:'no-store'});
  if(!response.ok)throw Error('Unable to load applications');
  setRows(await response.json() as Application[]);
 },[]);
 useEffect(()=>{void Promise.resolve().then(reload).catch(e=>setError(e instanceof Error?e.message:'Membership review unavailable'))},[reload]);
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
   await reload();
  }catch(e){setError(e instanceof Error?e.message:'Review failed')}
  finally{setBusy(false)}
 }
 return <section className="admin-panel">
  <h2>Membership applications — nonfinancial</h2>
  <p>Review identity/application eligibility only. Approval does not issue E-PINs, create genealogy positions, accept funds or grant earnings.</p>
  {error&&<p role="alert" className="admin-error">{error}</p>}
  {notice&&<p role="status" className="admin-success">{notice}</p>}
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
 </section>;
}
