'use client';
import {FormEvent,useCallback,useEffect,useState} from 'react';

type BatchKind='ACTIVATION';
type BatchPreview={
 quantity:number;
 pinType:BatchKind;
 expiresAt:string;
 issuanceStatus:'HOLD';
 canIssue:false;
 generated:0;
};

type HistoryEvent={id:string;action:'EPIN_BATCH_POLICY_VALIDATED';summary:string;createdAt:string};

async function loadHistory():Promise<HistoryEvent[]>{
 const response=await fetch('/api/admin/backend/staff/epin-batches/history',{cache:'no-store'});
 if(!response.ok)throw new Error('Your E-PIN validation history is unavailable');
 const data:unknown=await response.json();
 if(!Array.isArray(data)||data.length>25||
   !data.every((entry:unknown)=>{
    if(!entry||typeof entry!=='object')return false;
    const item=entry as Record<string,unknown>;
    return typeof item.id==='string'&&
     item.action==='EPIN_BATCH_POLICY_VALIDATED'&&
     typeof item.summary==='string'&&typeof item.createdAt==='string';
   }))throw new Error('Unexpected validation history response');
 return data as HistoryEvent[];
}


export function AdminEpinBatchValidationPanel(){
 const [quantity,setQuantity]=useState(1);
 const [expiresAt,setExpiresAt]=useState('');
 const [preview,setPreview]=useState<BatchPreview|null>(null);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [history,setHistory]=useState<HistoryEvent[]>([]);
 const [historyError,setHistoryError]=useState('');
 const [historyLoading,setHistoryLoading]=useState(true);
 const refreshHistory=useCallback(async()=>{
  setHistoryLoading(true);setHistoryError('');
  try{setHistory(await loadHistory())}
  catch(err){setHistory([]);setHistoryError(err instanceof Error?err.message:'History unavailable')}
  finally{setHistoryLoading(false)}
 },[]);
 useEffect(()=>{
  let active=true;
  void loadHistory().then(data=>{if(active)setHistory(data)})
   .catch(err=>{if(active)setHistoryError(err instanceof Error?err.message:'History unavailable')})
   .finally(()=>{if(active)setHistoryLoading(false)});
  return ()=>{active=false};
 },[]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  setBusy(true);setError('');setPreview(null);
  try{
   const response=await fetch('/api/admin/backend/staff/epin-batches/validate',{
    method:'POST',cache:'no-store',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({quantity,expiresAt})
   });
   const body=await response.json();
   if(!response.ok)throw new Error(
    Array.isArray(body?.message)?body.message.join(', '):
    (typeof body?.message==='string'?body.message:'Batch validation failed')
   );
   if(body.pinType!=='ACTIVATION'||body.issuanceStatus!=='HOLD'||body.canIssue!==false||body.generated!==0)
    throw new Error('Unsafe batch validation response');
   setPreview(body as BatchPreview);
   void refreshHistory();
  }catch(err){setError(err instanceof Error?err.message:'Batch validation failed')}
  finally{setBusy(false)}
 }
 return <section className="admin-panel">
  <h2>Registration E-PIN policy preview</h2>
  <p>ADMIN/SUPER_ADMIN only. Validation and audit are available; paid E-PIN issuance, purchase, activation and redemption remain on HOLD. <strong>No PIN codes are generated here.</strong></p>
  <form className="admin-form" onSubmit={submit}>
   <p><strong>Purpose:</strong> One-time registration E-PIN (internal code: ACTIVATION). No installment payment.</p>
   <label>Batch quantity (1–500)
    <input type="number" min={1} max={500} step={1} required value={quantity}
     onChange={e=>setQuantity(Number(e.target.value))}/>
   </label>
   <label>Expiry, including timezone (ISO 8601)
    <input type="text" maxLength={40} required value={expiresAt}
     onChange={e=>setExpiresAt(e.target.value)}
     placeholder="2027-01-31T23:59:00+05:30"/>
   </label>
   <button className="button" type="submit" disabled={busy}>
    {busy?'Validating…':'Validate batch policy'}
   </button>
  </form>
  {error&&<p role="alert" className="admin-error">{error}</p>}
  {preview&&<div role="status" className="admin-policy">
   <strong>HOLD — no E-PINs issued.</strong>
   <p>{preview.quantity} registration PIN candidates requested; expiry validated as {preview.expiresAt}.</p>
   <p>Generated: 0. Payment settlement, issuance and member activation are not enabled.</p>
  </div>}
  <div className="admin-policy">
   <h3>Your recent E-PIN policy validations</h3>
   <p>Last 25 successful checks from your own operator account. These are policy previews, not issued PINs or payment receipts.</p>
   <button className="button" type="button" onClick={()=>{void refreshHistory()}} disabled={historyLoading}>
    {historyLoading?'Loading history…':'Refresh history'}
   </button>
   {historyError&&<p role="alert">{historyError}</p>}
   {!historyLoading&&!historyError&&history.length===0&&<p>No policy validations recorded for your account.</p>}
   {history.length>0&&<div className="cms-list">{history.map(entry=>
    <article className="cms-row" key={entry.id}>
     <div><strong>Validation only — HOLD</strong><p>{entry.summary}</p></div>
     <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time>
    </article>
   )}</div>}
  </div>
 </section>;
}
