'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {AdminMemberGenealogy} from './admin-member-genealogy';
import {AdminMemberMatrix} from './admin-member-matrix';
import {AdminMemberEarnings} from './admin-member-earnings';
import {AdminVerifiedMemberSale} from './admin-verified-member-sale';
import {AdminMemberIdentityEditor} from './admin-member-identity-editor';
type Application={
 id:string;status:'SUBMITTED'|'UNDER_REVIEW'|'APPROVED'|'REJECTED'|'SUSPENDED'|'WITHDRAWN';
 createdAt:string;termsVersion:string;privacyVersion:string;decisionReason:string|null;
 member:{id:string;email:string;mobile:string|null;displayName:string;status:string;referralCode:string|null};canRecordSale?:boolean;
};
type ReviewFilter='ALL'|Application['status'];
type ReviewPage={items:Application[];nextCursor:string|null};
type LifecycleEvent={id:string;actorId:string;actorKind:'STAFF'|'MEMBER';
 action:string;summary:string;createdAt:string};
type LifecycleHistory={applicationId:string;events:LifecycleEvent[];truncated:boolean};
const REVIEW_STATUSES:ReviewFilter[]=['ALL','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','SUSPENDED','WITHDRAWN'];
export function MembershipReviewPanel({canViewGenealogy=false,canViewMatrix=false,compensationEnabled=false,autoActivate=false}:{canViewGenealogy?:boolean;canViewMatrix?:boolean;compensationEnabled?:boolean;autoActivate?:boolean}){
 const [rows,setRows]=useState<Application[]>([]);
 const [reason,setReason]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [filter,setFilter]=useState<ReviewFilter>('ALL');
 const [nextCursor,setNextCursor]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const requestSequence=useRef(0);
 const historySequence=useRef(0);
 const [historyFor,setHistoryFor]=useState<string|null>(null);
 const [genealogyFor,setGenealogyFor]=useState<string|null>(null);
 const [matrixFor,setMatrixFor]=useState<string|null>(null);
 const [earningsFor,setEarningsFor]=useState<string|null>(null);
 const [identityFor,setIdentityFor]=useState<string|null>(null);
 const [transactionReference,setTransactionReference]=useState(''),[transactionEvidence,setTransactionEvidence]=useState('');
 const [transactionReceivedAt,setTransactionReceivedAt]=useState('');
 const approvalRequestKey=useRef<string|null>(null);
 const [history,setHistory]=useState<LifecycleHistory|null>(null);
 const [historyLoading,setHistoryLoading]=useState(false);
 const [historyError,setHistoryError]=useState('');
 async function toggleHistory(id:string){
  const seq=++historySequence.current;
  if(historyFor===id){
   setHistoryFor(null);setHistory(null);setHistoryError('');setHistoryLoading(false);
   return;
  }
  setHistoryFor(id);setHistory(null);setHistoryError('');setHistoryLoading(true);
  try{
   const result=await fetch('/api/admin/backend/cms/membership/applications/'+id+'/history',{cache:'no-store'});
   if(!result.ok)throw Error('Application history unavailable');
   const data=await result.json() as LifecycleHistory;
   if(data.applicationId!==id||!Array.isArray(data.events)||data.events.length>50||
      typeof data.truncated!=='boolean')throw Error('Unexpected application history response');
   if(seq===historySequence.current)setHistory(data);
  }catch(e){
   if(seq===historySequence.current)setHistoryError(e instanceof Error?e.message:'History unavailable');
  }finally{if(seq===historySequence.current)setHistoryLoading(false)}
 }
 function clearHistory(){
  historySequence.current++;
  setHistoryFor(null);setHistory(null);setHistoryError('');setHistoryLoading(false);
 }

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
 async function perform(id:string,operation:'review'|'decide',status?:'APPROVED'|'REJECTED'|'SUSPENDED',reactivating=false){
  setBusy(true);setError('');setNotice('');
  try{
   const res=await fetch('/api/admin/backend/cms/membership/applications/'+id+'/'+operation,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(status?{
     status,reason,...(status==='APPROVED'&&compensationEnabled&&!reactivating?{
      transactionRequestKey:approvalRequestKey.current??=crypto.randomUUID(),
      transactionReference:transactionReference.trim(),
      transactionEvidenceRef:transactionEvidence.trim().toUpperCase(),
      transactionReceivedAt:new Date(transactionReceivedAt).toISOString()
     }:{})
    }:{})
   });
   const result=await res.json().catch(()=>null);
   if(!res.ok)throw Error(result?.message||'Review action rejected');
   setNotice(reactivating?'Member account reactivated; existing matrix positions preserved':
    status==='APPROVED'&&compensationEnabled?'Offline ₹15,000 transaction confirmed and member activated':
    'Application review recorded in the Foundation audit log');
   if(status==='APPROVED'){approvalRequestKey.current=null;setTransactionReference('');setTransactionEvidence('');setTransactionReceivedAt('')}
   clearHistory();
   await reload(filter,null,false);
  }catch(e){setError(e instanceof Error?e.message:'Review failed')}
  finally{setBusy(false)}
 }
 return <section className="admin-panel">
  <h2>{autoActivate?'Members':'Membership applications'}</h2>
  <p>{autoActivate?'Member accounts and placement status.':compensationEnabled?'Approval confirms the fixed ₹15,000 offline transaction, activates the member and processes referral/matrix earnings.':'Review member eligibility and account status.'}</p>
  {error&&<p role="alert" className="admin-error">{error}</p>}
  {notice&&<p role="status" className="admin-success">{notice}</p>}
  <label className="admin-reason">{autoActivate?'Status':'Application status'}
   <select value={filter} disabled={loading} onChange={event=>{
    const selected=event.target.value as ReviewFilter;
    setFilter(selected);
    clearHistory();
    void reload(selected,null,false);
   }}>
    {REVIEW_STATUSES.map(item=><option key={item} value={item}>{item==='ALL'?'All statuses':item.replaceAll('_',' ')}</option>)}
   </select>
  </label>
  <p role="status">{loading?'Loading members…':rows.length+(autoActivate?' members shown':' applications shown')}{nextCursor?' · More available':''}</p>
  <label className="admin-reason">{autoActivate?'Reason for suspension (minimum 8 characters)':'Decision reason (minimum 8 characters)'}<textarea maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
  {compensationEnabled&&!autoActivate&&<div className="admin-form">
   <p><strong>Approval transaction: ₹15,000 fixed offline amount</strong></p>
   <label>Offline transaction reference<input maxLength={80} value={transactionReference}
    onChange={e=>setTransactionReference(e.target.value)}/></label>
   <label>Evidence reference<input maxLength={120} value={transactionEvidence}
    onChange={e=>setTransactionEvidence(e.target.value.toUpperCase())}/></label>
   <label>Received date/time<input type="datetime-local" value={transactionReceivedAt}
    onChange={e=>setTransactionReceivedAt(e.target.value)}/></label>
  </div>}
  {rows.length===0?<p>No applications to review.</p>:<div className="cms-list">{rows.map(item=>
   <article key={item.id} className="cms-row">
    <div><strong>{item.member.displayName}</strong><p>{item.member.email} · {item.member.mobile??'Legacy mobile not recorded'}</p>
     <p>Referral code: {item.member.referralCode?<code>{item.member.referralCode}</code>:'Not assigned'}</p>
     <p>Status: {item.status} · Account: {item.member.status}</p>
     {!autoActivate&&<p>Terms: {item.termsVersion} · Privacy: {item.privacyVersion}</p>}
     {item.decisionReason&&<p>Previous decision reason: {item.decisionReason}</p>}
    </div>
    <div className="cms-row-actions">
     {!autoActivate&&item.status==='SUBMITTED'&&<button disabled={busy} onClick={()=>void perform(item.id,'review')}>Start review</button>}
     {!autoActivate&&item.status==='UNDER_REVIEW'&&<>
      <button disabled={busy||reason.trim().length<8||
       (compensationEnabled&&(!transactionReference.trim()||!transactionEvidence.trim()||!transactionReceivedAt))}
       onClick={()=>void perform(item.id,'decide','APPROVED')}>Approve & activate</button>
      <button disabled={busy||reason.trim().length<8} onClick={()=>void perform(item.id,'decide','REJECTED')}>Reject</button>
     </>}
     {item.status==='APPROVED'&&<button disabled={busy||reason.trim().length<8} onClick={()=>void perform(item.id,'decide','SUSPENDED')}>Suspend</button>}
     {item.status==='SUSPENDED'&&<button disabled={busy||reason.trim().length<8}
      onClick={()=>void perform(item.id,'decide','APPROVED',true)}>Reactivate member</button>}
     <button type="button" disabled={busy} aria-expanded={identityFor===item.member.id}
      onClick={()=>setIdentityFor(current=>current===item.member.id?null:item.member.id)}>
      {identityFor===item.member.id?'Hide contact editor':'Correct email/mobile'}
     </button>
     {compensationEnabled&&autoActivate&&item.canRecordSale&&
      <AdminVerifiedMemberSale memberId={item.member.id}/>}
     {compensationEnabled&&item.status==='APPROVED'&&<button type="button" disabled={busy}
      aria-expanded={earningsFor===item.member.id}
      onClick={()=>setEarningsFor(value=>value===item.member.id?null:item.member.id)}>
      {earningsFor===item.member.id?'Hide earnings':'Earnings & settlements'}
     </button>}
     {canViewMatrix&&item.status==='APPROVED'&&<button type="button" disabled={busy}
      aria-expanded={matrixFor===item.member.id}
      onClick={()=>setMatrixFor(value=>value===item.member.id?null:item.member.id)}>
      {matrixFor===item.member.id?'Hide matrix':'View 1:3 matrix'}
     </button>}
     {canViewGenealogy&&<button type="button" disabled={busy}
      aria-expanded={genealogyFor===item.member.id}
      onClick={()=>setGenealogyFor(value=>value===item.member.id?null:item.member.id)}>
      {genealogyFor===item.member.id?'Hide genealogy':'View genealogy'}
     </button>}
     <button type="button" disabled={busy} aria-expanded={historyFor===item.id}
      onClick={()=>void toggleHistory(item.id)}>
      {historyFor===item.id?'Hide history':'Activity history'}
     </button>
    </div>
    {compensationEnabled&&item.status==='APPROVED'&&earningsFor===item.member.id&&
     <AdminMemberEarnings memberId={item.member.id}/>}
    {canViewMatrix&&item.status==='APPROVED'&&matrixFor===item.member.id&&
     <AdminMemberMatrix memberId={item.member.id}/>} 
    {canViewGenealogy&&genealogyFor===item.member.id&&
     <AdminMemberGenealogy memberId={item.member.id}/>}
    {identityFor===item.member.id&&<AdminMemberIdentityEditor memberId={item.member.id}
     currentEmail={item.member.email} currentMobile={item.member.mobile}
     onSaved={async()=>{
      setIdentityFor(null);setNotice('Member contact corrected and sessions revoked');
      await reload(filter,null,false);
     }}/>}
    {historyFor===item.id&&<div className="admin-policy">
     <h3>Member activity</h3>
     {historyLoading&&<p role="status">Loading review history…</p>}
     {historyError&&<p role="alert">{historyError}</p>}
     {history&&!historyLoading&&<>
      {history.events.length===0?<p>No lifecycle audit events recorded.</p>:
       <ol>{history.events.map(event=><li key={event.id}>
        <strong>{event.action.replaceAll('_',' ')}</strong> — {event.summary}
        <p><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
        {' · '}{event.actorKind} actor: {event.actorId}</p>
       </li>)}</ol>}
      {history.truncated&&<p>Showing the 50 most recent lifecycle events; older events remain in the audit stores.</p>}
     </>}
    </div>}
   </article>)}</div>}
  {nextCursor&&<button className="button" type="button" disabled={loading||busy}
    onClick={()=>void reload(filter,nextCursor,true)}>Load more applications</button>}
 </section>;
}
