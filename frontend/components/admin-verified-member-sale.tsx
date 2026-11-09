'use client';
import {FormEvent,useRef,useState} from 'react';

/** Staff records a real external receipt; this never approves membership. */
export function AdminVerifiedMemberSale({memberId}:{memberId:string}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 const [reference,setReference]=useState(''),[evidence,setEvidence]=useState('');
 const [receivedAt,setReceivedAt]=useState(''),[error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const pending=useRef<{fingerprint:string;requestKey:string}|null>(null);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy)return;
  const timestamp=new Date(receivedAt);
  if(!Number.isFinite(timestamp.getTime())||timestamp.getTime()>Date.now()){
   setError('Enter the actual payment date and time.');return;
  }
  const fields={
   transactionReference:reference.trim().toUpperCase(),
   transactionEvidenceRef:evidence.trim().toUpperCase(),
   transactionReceivedAt:timestamp.toISOString()
  };
  const fingerprint=JSON.stringify(fields);
  if(pending.current?.fingerprint!==fingerprint)
   pending.current={fingerprint,requestKey:crypto.randomUUID()};
  setBusy(true);setError('');setSuccess('');
  try{
   const response=await fetch('/api/admin/backend/cms/membership/members/'+memberId+'/sale',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...fields,transactionRequestKey:pending.current.requestKey})
   });
   const result=await response.json().catch(()=>null);
   if(!response.ok)throw new Error(Array.isArray(result?.message)?result.message.join(', '):
    typeof result?.message==='string'?result.message:'Payment could not be recorded');
   if(result?.memberId!==memberId||result?.amountPaise!==1_500_000)
    throw new Error('Unexpected payment confirmation');
   pending.current=null;
   setSuccess('Payment recorded. Eligible direct referral earnings have been updated.');
   setOpen(false);
  }catch(err){setError(err instanceof Error?err.message:'Unable to record payment')}
  finally{setBusy(false)}
 }
 return <div className="admin-sale-action">
  <button type="button" disabled={busy} aria-expanded={open}
   onClick={()=>setOpen(value=>!value)}>{open?'Cancel':'Record payment'}</button>
  {success&&<p role="status" className="admin-success">{success}</p>}
  {error&&<p role="alert" className="admin-error">{error}</p>}
  {open&&<form className="admin-form" onSubmit={submit}>
   <p>Record a verified external ₹15,000 transaction for this active member.</p>
   <label>Payment reference
    <input required maxLength={80} pattern="[A-Za-z0-9][A-Za-z0-9/_-]{5,79}"
     value={reference} onChange={event=>setReference(event.target.value)}/>
   </label>
   <label>Evidence reference
    <input required maxLength={120} pattern="[A-Z0-9][A-Z0-9_-]{5,119}"
     value={evidence} onChange={event=>setEvidence(event.target.value.toUpperCase())}/>
   </label>
   <label>Date and time received
    <input required type="datetime-local" value={receivedAt}
     onChange={event=>setReceivedAt(event.target.value)}/>
   </label>
   <button className="button" type="submit" disabled={busy}>
    {busy?'Recording…':'Save payment'}
   </button>
  </form>}
 </div>;
}
