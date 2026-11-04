'use client';
import {FormEvent,useState} from 'react';
import {localExpiryToUtcIso} from '@/lib/epin-expiry';

/** Demo-only credentials; never payment or real paid E-PIN issuance. */
export function AdminUatSignupPins(){
 const [quantity,setQuantity]=useState('3');
 const [expiresAt,setExpiresAt]=useState('');
 const [codes,setCodes]=useState<string[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [batch,setBatch]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const expiry=localExpiryToUtcIso(expiresAt);
  if(!expiry){setError('Choose a valid date and time');return}
  setBusy(true);setError('');setCodes([]);setBatch('');
  try{
   const requestKey=crypto.randomUUID();
   const response=await fetch('/api/admin/backend/cms/membership/uat-pins',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({quantity:Number(quantity),expiresAt:expiry,requestKey})
   });
   const result=await response.json().catch(()=>null);
   if(!response.ok)throw Error(typeof result?.message==='string'?result.message:'Unable to create synthetic PINs');
   if(result?.classification!=='SYNTHETIC_NONFINANCIAL_UAT_ONLY'||
      !Array.isArray(result.codes)||result.codes.length!==Number(quantity))
     throw Error('Invalid synthetic PIN batch response');
   setCodes(result.codes);setBatch(result.batchId);
  }catch(err){setError(err instanceof Error?err.message:'Synthetic PIN request failed')}
  finally{setBusy(false)}
 }
 return <section className="admin-panel">
  <h2>Generate synthetic registration E-PINs (UAT only)</h2>
  <p>These nonfinancial codes work only in the disposable local MySQL UAT stack.
   They never collect fees, issue paid E-PINs, activate memberships or grant commissions.
   Codes appear exactly once; do not use real applicant data.</p>
  <form className="admin-form" onSubmit={submit}>
   <label>Quantity (1–50)<input type="number" min={1} max={50} step={1}
    value={quantity} onChange={e=>setQuantity(e.target.value)} required/></label>
   <label>Expiry date and time (device local time)
    <input type="datetime-local" step={60} value={expiresAt} onChange={e=>setExpiresAt(e.target.value)} required/>
   </label>
   {expiresAt&&<p>UTC expiry: {localExpiryToUtcIso(expiresAt)||'Invalid date or time'}</p>}
   <button className="button" disabled={busy}>{busy?'Generating…':'Generate synthetic E-PINs'}</button>
  </form>
  {error&&<p role="alert" className="admin-error">{error}</p>}
  {codes.length>0&&<div role="status">
   <p><strong>One-time display:</strong> {codes.length} synthetic codes from batch {batch}.
    Copy them securely for fake-member UAT. Reloading will erase the displayed secrets.</p>
   <textarea readOnly aria-label="One-time synthetic E-PIN codes" rows={Math.min(12,codes.length+1)} value={codes.join('\n')}/>
  </div>}
 </section>;
}
