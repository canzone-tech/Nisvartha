'use client';
import {FormEvent,useCallback,useEffect,useRef,useState} from 'react';
type Refund={id:string;bankReference:string;amountPaise:number;status:'PENDING'|'CONFIRMED'|'REJECTED';events:{kind:string}[]};
type Register={availablePaise:string;reservedPaise:string;confirmedPaise:string;items:Refund[]};
const money=(p:number|string)=>(Number(p)/100).toLocaleString('en-IN',{style:'currency',currency:'INR'});
export function DonationRefundPanel({receiptId,onUpdated}:{receiptId:string;onUpdated:()=>Promise<void>}){
 const [open,setOpen]=useState(false),[data,setData]=useState<Register|null>(null);
 const [reference,setReference]=useState(''),[amount,setAmount]=useState(''),[evidence,setEvidence]=useState('');
 const [reviewEvidence,setReviewEvidence]=useState(''),[error,setError]=useState(''),[feedback,setFeedback]=useState('');
 const [busy,setBusy]=useState(false);
 const createKey=useRef<string|null>(null),reviewKeys=useRef<Record<string,string>>({});
 const base='/api/admin/backend/staff/donations/'+receiptId+'/refunds';
 const load=useCallback(async()=>{
  const result=await fetch(base,{cache:'no-store'});
  const body=await result.json().catch(()=>null);
  if(!result.ok)throw Error(typeof body?.message==='string'?body.message:'Refund register unavailable');
  setData(body as Register);
 },[base]);
 useEffect(()=>{if(!open)return;let alive=true;
  void Promise.resolve().then(load).catch(e=>{if(alive)setError(String(e))});
  return ()=>{alive=false};
 },[open,load]);
 async function post(path:string,payload:object){
  setBusy(true);setError('');setFeedback('');
  try{
   const response=await fetch(base+path,{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const body=await response.json().catch(()=>null);
   if(!response.ok)throw Error(typeof body?.message==='string'?body.message:'Refund action refused');
   await load();await onUpdated();
   setFeedback('Refund action saved and audited');
   return true;
  }catch(e){setError(e instanceof Error?e.message:'Refund operation failed');return false}
  finally{setBusy(false)}
 }
 async function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const paise=Number(amount);
  if(!Number.isSafeInteger(paise)||paise<1||paise>2147483647){
   setError('Refund amount must be a positive integer in paise');return;
  }
  const requestKey=createKey.current??crypto.randomUUID();createKey.current=requestKey;
  if(await post('',{requestKey,bankReference:reference,amountPaise:paise,evidenceRef:evidence})){
   createKey.current=null;setReference('');setAmount('');setEvidence('');
  }
 }
 async function reconcile(refund:Refund,status:'CONFIRMED'|'REJECTED'){
  const requestKey=reviewKeys.current[refund.id]??crypto.randomUUID();
  reviewKeys.current[refund.id]=requestKey;
  if(await post('/'+refund.id+'/reconcile',{requestKey,status,evidenceRef:reviewEvidence})){
   delete reviewKeys.current[refund.id];setReviewEvidence('');
  }
 }
 return <section className="admin-case-detail">
  <button type="button" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
   {open?'Hide refunds':'Manage refunds'}
  </button>
  {open&&<div>
   <p>Offline bank evidence only. Pending refunds reserve funds; confirmed refunds reduce net donations. No bank transfer is initiated.</p>
   {error&&<p role="alert" className="admin-error">{error}</p>}
   {feedback&&<p role="status">{feedback}</p>}
   {data&&<p role="status">Available {money(data.availablePaise)} · Reserved {money(data.reservedPaise)} · Confirmed {money(data.confirmedPaise)}</p>}
   {data&&data.availablePaise!=='0'&&<form className="admin-form" onSubmit={e=>void create(e)}>
    <label>Outgoing bank reference <input required minLength={6} maxLength={80} value={reference} onChange={e=>{createKey.current=null;setReference(e.target.value)}}/></label>
    <label>Refund amount (paise) <input required type="number" min={1} max={2147483647} step={1} value={amount} onChange={e=>{createKey.current=null;setAmount(e.target.value)}}/></label>
    <label>Initiation evidence ID <input required minLength={6} maxLength={120} value={evidence} onChange={e=>{createKey.current=null;setEvidence(e.target.value)}}/></label>
    <button type="submit" disabled={busy}>Reserve pending refund</button>
   </form>}
   {data?.items.map(refund=><article className="cms-row" key={refund.id}>
    <div><strong>{refund.bankReference}</strong><p>{money(refund.amountPaise)} · {refund.status}</p>
     <p>Audit: {refund.events.map(e=>e.kind).join(' → ')}</p></div>
    {refund.status==='PENDING'&&<div className="cms-row-actions">
     <label>Bank statement review ID <input required minLength={6} maxLength={120}
      value={reviewEvidence} onChange={e=>{reviewKeys.current={};setReviewEvidence(e.target.value)}}/></label>
     <button type="button" disabled={busy||reviewEvidence.length<6} onClick={()=>void reconcile(refund,'CONFIRMED')}>Confirm refund</button>
     <button type="button" disabled={busy||reviewEvidence.length<6} onClick={()=>void reconcile(refund,'REJECTED')}>Reject refund</button>
    </div>}
   </article>)}
  </div>}
 </section>;
}
