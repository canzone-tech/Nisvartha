'use client';
import {FormEvent,useState} from 'react';

type BatchKind='ACTIVATION'|'INSTALLMENT';
type BatchPreview={
 quantity:number;
 pinType:BatchKind;
 expiresAt:string;
 issuanceStatus:'HOLD';
 canIssue:false;
 generated:0;
};

export function AdminEpinBatchValidationPanel(){
 const [quantity,setQuantity]=useState(1);
 const [pinType,setPinType]=useState<BatchKind>('ACTIVATION');
 const [expiresAt,setExpiresAt]=useState('');
 const [preview,setPreview]=useState<BatchPreview|null>(null);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  setBusy(true);setError('');setPreview(null);
  try{
   const response=await fetch('/api/admin/backend/staff/epin-batches/validate',{
    method:'POST',cache:'no-store',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({quantity,pinType,expiresAt})
   });
   const body=await response.json();
   if(!response.ok)throw new Error(
    Array.isArray(body?.message)?body.message.join(', '):
    (typeof body?.message==='string'?body.message:'Batch validation failed')
   );
   if(body.issuanceStatus!=='HOLD'||body.canIssue!==false||body.generated!==0)
    throw new Error('Unsafe batch validation response');
   setPreview(body as BatchPreview);
  }catch(err){setError(err instanceof Error?err.message:'Batch validation failed')}
  finally{setBusy(false)}
 }
 return <section className="admin-panel">
  <h2>E-PIN batch policy preview</h2>
  <p>ADMIN/SUPER_ADMIN only. Validation and audit are available; paid E-PIN issuance, purchase, activation and redemption remain on HOLD. <strong>No PIN codes are generated here.</strong></p>
  <form className="admin-form" onSubmit={submit}>
   <label>PIN type
    <select value={pinType} onChange={e=>setPinType(e.target.value as BatchKind)}>
     <option value="ACTIVATION">ACTIVATION</option>
     <option value="INSTALLMENT">INSTALLMENT</option>
    </select>
   </label>
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
   <p>{preview.quantity} {preview.pinType} PIN candidates requested; expiry validated as {preview.expiresAt}.</p>
   <p>Generated: 0. Payment settlement, issuance and member activation are not enabled.</p>
  </div>}
 </section>;
}
