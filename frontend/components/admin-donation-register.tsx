'use client';
import {FormEvent,useCallback,useEffect,useRef,useState} from 'react';
type Receipt={id:string;bankReference:string;amountPaise:number;status:string;
 receivedAt:string;evidenceRef:string;events:{kind:string;createdAt:string}[]};
type Results={counts:{pending:number;reconciled:number;rejected:number};
 reconciledPaise:number;items:Receipt[];nextCursor:string|null};
const money=(paise:number)=>(paise/100).toLocaleString('en-IN',{style:'currency',currency:'INR'});
export function DonationRegister(){
 const [list,setList]=useState<Results|null>(null),[rows,setRows]=useState<Receipt[]>([]);
 const [bank,setBank]=useState(''),[amount,setAmount]=useState(''),[received,setReceived]=useState('');
 const [evidence,setEvidence]=useState(''),[reviewEvidence,setReviewEvidence]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[info,setInfo]=useState('');
 const pending=useRef<string|null>(null),decision=useRef<string|null>(null);
 const load=useCallback(async(cursor?:string)=>{
  const q=new URLSearchParams();if(cursor)q.set('cursor',cursor);
  const res=await fetch('/api/admin/backend/staff/donations?'+q,{cache:'no-store'});
  const data=await res.json();
  if(!res.ok)throw Error(typeof data?.message==='string'?data.message:'Unable to read donation register');
  return data as Results;
 },[]);
 useEffect(()=>{let active=true;void load().then(x=>{if(active){setList(x);setRows(x.items)}})
  .catch(e=>{if(active)setError(String(e))});return ()=>{active=false}},[load]);
 async function post(path:string,body:object){
  setBusy(true);setError('');setInfo('');
  try{
   const res=await fetch('/api/admin/backend/staff/donations'+path,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
   });
   const data=await res.json().catch(()=>null);
   if(!res.ok)throw Error(typeof data?.message==='string'?data.message:'Operation refused');
   const updated=await load();setList(updated);setRows(updated.items);
   setInfo('Saved and audited. This is offline evidence, not automatic bank confirmation.');
   return true;
  }catch(e){setError(e instanceof Error?e.message:'Operation failed');return false}
  finally{setBusy(false)}
 }
 async function record(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const paise=Number(amount);
  if(!Number.isSafeInteger(paise)||paise<1||paise>2147483647){setError('Enter a positive integer amount in paise');return}
  const date=new Date(received);
  if(!Number.isFinite(date.getTime())){setError('Invalid received date');return}
  const key=pending.current??crypto.randomUUID();pending.current=key;
  if(await post('',{requestKey:key,bankReference:bank,amountPaise:paise,
    receivedAt:date.toISOString(),evidenceRef:evidence})){
   pending.current=null;setBank('');setAmount('');setReceived('');setEvidence('');
  }
 }
 async function review(id:string,status:'RECONCILED'|'REJECTED'){
  const key=decision.current??crypto.randomUUID();decision.current=key;
  if(await post('/'+id+'/reconcile',{requestKey:key,status,evidenceRef:reviewEvidence})){
   decision.current=null;setReviewEvidence('');
  }
 }
 async function more(){
  if(!list?.nextCursor)return;
  setBusy(true);try{const next=await load(list.nextCursor);setRows(prev=>[...prev,...next.items]);setList(next)}
  catch(e){setError(String(e))}finally{setBusy(false)}
 }
 return <section className="admin-panel">
  <h2>Offline donation register</h2>
  <p>One ADMIN records and reconciles standalone donations against external bank evidence. No payment gateway, joining fee, referral commission, matrix reward or wallet activity is triggered.</p>
  {list&&<p role="status">Pending {list.counts.pending} · Reconciled {list.counts.reconciled} · Rejected {list.counts.rejected} · Attested total {money(list.reconciledPaise)}</p>}
  {error&&<p role="alert" className="admin-error">{error}</p>}
  {info&&<p role="status" className="admin-success">{info}</p>}
  <form className="admin-form" onSubmit={e=>void record(e)}>
   <h3>Record pending donation</h3>
   <label>Bank reference <input required minLength={6} maxLength={80} value={bank} onChange={e=>{pending.current=null;setBank(e.target.value)}}/></label>
   <label>Amount (paise) <input required type="number" min={1} step={1} max={2147483647} value={amount} onChange={e=>{pending.current=null;setAmount(e.target.value)}}/></label>
   <label>Received date/time <input required type="datetime-local" value={received} onChange={e=>{pending.current=null;setReceived(e.target.value)}}/></label>
   <label>Evidence reference <input required minLength={6} maxLength={120} value={evidence} onChange={e=>{pending.current=null;setEvidence(e.target.value)}}/></label>
   <button type="submit" disabled={busy}>Record pending donation</button>
  </form>
  <div className="cms-list">{rows.map(x=><article key={x.id} className="cms-row">
   <div><strong>{x.bankReference}</strong><p>{money(x.amountPaise)} · {x.status}</p>
   <p>Evidence: {x.evidenceRef} · {new Date(x.receivedAt).toLocaleString()}</p>
   <p>History: {x.events.map(e=>e.kind).join(' → ')}</p></div>
   {x.status==='PENDING'&&<div className="cms-row-actions">
    <label>Bank reconciliation evidence <input minLength={6} maxLength={120} value={reviewEvidence}
     onChange={e=>{decision.current=null;setReviewEvidence(e.target.value)}}/></label>
    <button disabled={busy||reviewEvidence.length<6} type="button" onClick={()=>void review(x.id,'RECONCILED')}>Reconcile</button>
    <button disabled={busy||reviewEvidence.length<6} type="button" onClick={()=>void review(x.id,'REJECTED')}>Reject</button>
   </div>}
  </article>)}</div>
  {list?.nextCursor&&<button type="button" disabled={busy} onClick={()=>void more()}>Load more</button>}
 </section>;
}
