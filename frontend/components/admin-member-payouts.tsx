'use client';
import {Fragment,FormEvent,useCallback,useEffect,useRef,useState} from 'react';

type PendingPayout={
 id:string;amountPaise:number;status:'REQUESTED';createdAt:string;
 payoutMethod?:'BANK'|'UPI'|null;destinationMask?:string|null;
 member:{id:string;displayName:string;email:string};
};
const money=(p:number)=>'₹'+(p/100).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
type PayoutDestinationResponse={id:string;legacy:boolean;
 payoutMethod:'BANK'|'UPI'|null;mask:string|null;
 destination:{method:'BANK';holderName:string;accountNumber:string;ifsc:string}|
  {method:'UPI';upiId:string}|null};
function PayoutDestinationDetails({id}:{id:string}){
 const [record,setRecord]=useState<PayoutDestinationResponse|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{let active=true;void Promise.resolve().then(async()=>{
  try{
   const response=await fetch('/api/admin/backend/cms/membership/payouts/'+id+'/payment-details',{
    cache:'no-store'
   });
   const data=await response.json().catch(()=>null) as PayoutDestinationResponse|null;
   if(!response.ok||!data||data.id!==id)throw Error('Protected payout destination unavailable');
   if(active)setRecord(data);
  }catch(err){if(active)setError(err instanceof Error?err.message:'Payout destination unavailable')}
 });return()=>{active=false}},[id]);
 return <div className="admin-policy" aria-label="Protected payout destination">
  <h4>Original payout destination (audited Admin access)</h4>
  {error&&<p className="admin-error" role="alert">{error}</p>}
  {!error&&!record&&<p role="status">Loading protected details…</p>}
  {record?.legacy&&<p role="status">Legacy payout: no saved Bank/UPI snapshot.
   Verify the recipient independently before making an offline transfer.</p>}
  {record?.destination?.method==='BANK'&&<dl>
   <dt>Account holder</dt><dd>{record.destination.holderName}</dd>
   <dt>Account number</dt><dd><code>{record.destination.accountNumber}</code></dd>
   <dt>IFSC</dt><dd><code>{record.destination.ifsc}</code></dd>
  </dl>}
  {record?.destination?.method==='UPI'&&<p>UPI ID: <code>{record.destination.upiId}</code></p>}
  {record&&!record.legacy&&<p>Details are frozen at request time;
   later profile edits do not alter this transfer destination.</p>}
 </div>;
}
function PayoutDecision({item,onDone}:{item:PendingPayout;onDone:()=>void}){
 const [status,setStatus]=useState<'PAID'|'REJECTED'>('PAID');
 const [reference,setReference]=useState(''),[evidence,setEvidence]=useState('');
 const [paidAt,setPaidAt]=useState(''),[reason,setReason]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const request=useRef<{key:string;fingerprint:string}|null>(null);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy)return;
  const values=status==='PAID'?{
   status,settlementReference:reference.trim().toUpperCase(),
   settlementEvidenceRef:evidence.trim().toUpperCase(),
   paidAt:new Date(paidAt).toISOString()
  }:{status,rejectionReason:reason.trim()};
  const fingerprint=JSON.stringify(values);
  if(request.current?.fingerprint!==fingerprint)
   request.current={fingerprint,key:crypto.randomUUID()};
  setBusy(true);setError('');
  try{
   const result=await fetch('/api/admin/backend/cms/membership/payouts/'+item.id+'/decide',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...values,decisionRequestKey:request.current.key})
   });
   const response=await result.json().catch(()=>null);
   if(!result.ok)throw Error(response?.message||'Could not record payout decision');
   request.current=null;
   onDone();
  }catch(err){setError(err instanceof Error?err.message:'Unable to update payout')}
  finally{setBusy(false)}
 }
 return <div className="admin-policy">
  <p><strong>{item.member.displayName}</strong> · {money(item.amountPaise)} · Requested {new Date(item.createdAt).toLocaleString('en-IN')}</p>
  <PayoutDestinationDetails id={item.id}/>
  <form className="admin-form" onSubmit={submit} aria-label={'Decide payout for '+item.member.displayName}>
   <label>Decision
    <select value={status} onChange={event=>setStatus(event.target.value as 'PAID'|'REJECTED')}>
     <option value="PAID">Mark paid</option><option value="REJECTED">Reject request</option>
    </select>
   </label>
   {status==='PAID'?<>
    <label>Payment reference
     <input value={reference} maxLength={80} required pattern="[A-Za-z0-9][A-Za-z0-9/_-]{5,79}"
      onChange={event=>setReference(event.target.value)}/>
    </label>
    <label>Payment evidence reference
     <input value={evidence} maxLength={120} required pattern="[A-Za-z0-9_-]{6,120}"
      onChange={event=>setEvidence(event.target.value.toUpperCase())}/>
    </label>
    <label>Payment date and time
     <input type="datetime-local" required value={paidAt}
      onChange={event=>setPaidAt(event.target.value)}/>
    </label>
   </>:<label>Reason
    <textarea required minLength={8} maxLength={500} value={reason}
     onChange={event=>setReason(event.target.value)}/>
   </label>}
   {error&&<p role="alert" className="admin-error">{error}</p>}
   <button className="button" disabled={busy} type="submit">
    {busy?'Saving…':status==='PAID'?'Record payment':'Reject payout'}
   </button>
  </form>
 </div>;
}
type PayoutStatus='ALL'|'REQUESTED'|'PAID'|'REJECTED';
type PayoutRow=PendingPayout&{status:'REQUESTED'|'PAID'|'REJECTED';
 decidedAt:string|null;settlementReference:string|null;paidAt:string|null;
 rejectionReason:string|null;member:PendingPayout['member']&{status:string}};
type PayoutPage={status:PayoutStatus;matchingTotal:number;
 items:PayoutRow[];nextCursor:string|null};
const statuses:PayoutStatus[]=['REQUESTED','PAID','REJECTED','ALL'];
const PAGE_SIZE=25;

export function AdminMemberPayouts(){
 const [filter,setFilter]=useState<PayoutStatus>('REQUESTED');
 const [cursor,setCursor]=useState<string|null>(null);
 const [history,setHistory]=useState<(string|null)[]>([]);
 const [page,setPage]=useState<PayoutPage|null>(null);
 const [openId,setOpenId]=useState<string|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState('');
 const requestSeq=useRef(0);
 const reload=useCallback(async()=>{
  const seq=++requestSeq.current;
  setLoading(true);setError('');
  const query=new URLSearchParams({status:filter,limit:String(PAGE_SIZE)});
  if(cursor)query.set('cursor',cursor);
  try{
   const result=await fetch('/api/admin/backend/cms/membership/payouts/page?'+query,{
    cache:'no-store'
   });
   const response=await result.json().catch(()=>null) as PayoutPage|null;
   if(!result.ok)throw Error('Unable to load payout history');
   if(!response||!Array.isArray(response.items)||response.items.length>PAGE_SIZE||
      typeof response.matchingTotal!=='number'||
      (response.nextCursor!==null&&typeof response.nextCursor!=='string'))
    throw Error('Unexpected payout history response');
   if(seq===requestSeq.current)setPage(response);
  }catch(err){
   if(seq===requestSeq.current){setError(err instanceof Error?err.message:'Payout history unavailable');setPage(null)}
  }finally{if(seq===requestSeq.current)setLoading(false)}
 },[filter,cursor]);
 useEffect(()=>{void Promise.resolve().then(reload)},[reload]);
 function changeStatus(next:PayoutStatus){
  setFilter(next);setCursor(null);setHistory([]);setOpenId(null);
 }
 function nextPage(){
  if(!page?.nextCursor||loading)return;
  setHistory(h=>[...h,cursor]);setCursor(page.nextCursor);setOpenId(null);
 }
 function previousPage(){
  if(!history.length||loading)return;
  setCursor(history[history.length-1]);setHistory(h=>h.slice(0,-1));setOpenId(null);
 }
 function onDone(){
  setOpenId(null);
  // A decision changes the filtered status, so return to a valid first-page
  // cursor instead of continuing from a now-moved/deleted page anchor.
  setHistory([]);setCursor(null);
  if(cursor===null)void reload();
 }
 return <section className="admin-panel" aria-label="Member payouts">
  <div className="admin-heading"><div>
   <h2>Payout request history</h2>
   <p>Authoritative member wallet requests, including pending, paid and rejected records.</p>
  </div><button className="button alt" type="button" disabled={loading}
   onClick={()=>void reload()}>Refresh</button></div>
  <label className="admin-reason">Filter by status
   <select value={filter} disabled={loading} onChange={e=>changeStatus(e.target.value as PayoutStatus)}>
    {statuses.map(status=><option key={status} value={status}>
     {status==='ALL'?'All requests':status==='REQUESTED'?'Pending':status==='PAID'?'Paid':'Rejected'}
    </option>)}
   </select>
  </label>
  <p role="status">{loading?'Loading payout records…':page?
   page.matchingTotal+' matching requests · Page '+(history.length+1):'No records loaded'}</p>
  {error&&<p role="alert" className="admin-error">{error}</p>}
  {page&&page.items.length===0&&!loading&&<p>No payout requests match this filter.</p>}
  {page&&page.items.length>0&&<div className="table-scroll" role="region"
   aria-label="Payout records table" tabIndex={0}>
   <table className="admin-pin-table">
    <thead><tr><th>Member</th><th>Amount</th><th>Requested</th>
     <th>Status</th><th>Destination</th><th>Transfer reference</th><th>Action</th></tr></thead>
    <tbody>{page.items.map(item=><Fragment key={item.id}>
     <tr>
      <td><strong>{item.member.displayName}</strong>
       <p>{item.member.email}</p><small>Account: {item.member.status}</small></td>
      <td>{money(item.amountPaise)}</td>
      <td>{new Date(item.createdAt).toLocaleString('en-IN')}</td>
      <td>{item.status==='REQUESTED'?'Pending':item.status==='PAID'?'Paid':'Rejected'}</td>
      <td>{item.destinationMask??'Legacy record'}</td>
      <td>{item.settlementReference??'—'}</td>
      <td>{item.status==='REQUESTED'?
       <button className="button alt" type="button" aria-expanded={openId===item.id}
        onClick={()=>setOpenId(current=>current===item.id?null:item.id)}>
        {openId===item.id?'Close':'Settle / reject'}</button>:
       <button className="button alt" type="button" aria-expanded={openId===item.id}
        onClick={()=>setOpenId(current=>current===item.id?null:item.id)}>
        {openId===item.id?'Close':'Details'}</button>}</td>
     </tr>
     {openId===item.id&&<tr><td colSpan={7}>
      {item.status==='REQUESTED'?<PayoutDecision item={item} onDone={onDone}/>:
       <div className="admin-policy">
        <PayoutDestinationDetails id={item.id}/>
        <strong>{item.status==='PAID'?'Transfer recorded':'Request rejected'}</strong>
        <p>Decision: {item.decidedAt?new Date(item.decidedAt).toLocaleString('en-IN'):'—'}</p>
        {item.paidAt&&<p>Paid: {new Date(item.paidAt).toLocaleString('en-IN')}</p>}
        {item.rejectionReason&&<p>Reason: {item.rejectionReason}</p>}
       </div>}
     </td></tr>}
    </Fragment>)}</tbody>
   </table>
  </div>}
  <div className="admin-pin-issued-actions" aria-label="Payout pagination">
   <button className="button alt" type="button" disabled={loading||history.length===0}
    onClick={previousPage}>Previous page</button>
   <button className="button alt" type="button" disabled={loading||!page?.nextCursor}
    onClick={nextPage}>Next page</button>
  </div>
 </section>;
}
