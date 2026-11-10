'use client';
import {FormEvent,useCallback,useEffect,useRef,useState} from 'react';

type PendingPayout={
 id:string;amountPaise:number;status:'REQUESTED';createdAt:string;
 member:{id:string;displayName:string;email:string};
};
const money=(p:number)=>'₹'+(p/100).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
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
 return <article className="cms-row">
  <div>
   <strong>{item.member.displayName}</strong> · {money(item.amountPaise)}
   <p>{item.member.email}</p>
   <p>Requested {new Date(item.createdAt).toLocaleString('en-IN')}</p>
  </div>
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
 </article>;
}
export function AdminMemberPayouts(){
 const [items,setItems]=useState<PendingPayout[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState('');
 const reload=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const result=await fetch('/api/admin/backend/cms/membership/payouts',{cache:'no-store'});
   if(!result.ok)throw Error('Unable to load payout requests');
   const rows=await result.json() as PendingPayout[];
   if(!Array.isArray(rows))throw Error('Unexpected payout list');
   setItems(rows);
  }catch(err){setError(err instanceof Error?err.message:'Payout list unavailable')}
  finally{setLoading(false)}
 },[]);
 useEffect(()=>{void Promise.resolve().then(reload)},[reload]);
 return <section className="admin-panel" aria-label="Member payouts">
  <h2>Payout requests</h2>
  {loading&&<p role="status">Loading payouts…</p>}
  {error&&<p role="alert" className="admin-error">{error}</p>}
  {!loading&&items.length===0?<p>No pending payouts.</p>:
   <div className="cms-list">{items.map(item=>
    <PayoutDecision key={item.id} item={item} onDone={()=>void reload()}/>)}</div>}
 </section>;
}
