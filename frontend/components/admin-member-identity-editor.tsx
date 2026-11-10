'use client';
import {FormEvent,useState} from 'react';

/** Contact corrections are staff-only. Members may edit only their display name. */
export function AdminMemberIdentityEditor({memberId,currentEmail,currentMobile,onSaved}:{
 memberId:string;currentEmail:string;currentMobile:string|null;onSaved:()=>Promise<void>
}){
 const [email,setEmail]=useState(currentEmail);
 const [mobile,setMobile]=useState(currentMobile??'');
 const [reason,setReason]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy)return;
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/admin/backend/cms/membership/members/'+memberId+'/identity',{
    method:'PATCH',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email:email.trim(),...(mobile.trim()?{mobile:mobile.trim()}:{}),reason:reason.trim()})
   });
   const body=await response.json().catch(()=>null);
   if(!response.ok)throw Error(Array.isArray(body?.message)?body.message.join(', '):
    typeof body?.message==='string'?body.message:'Contact correction rejected');
   await onSaved();
  }catch(err){setError(err instanceof Error?err.message:'Contact correction failed')}
  finally{setBusy(false)}
 }
 return <form className="admin-form" onSubmit={event=>void save(event)}>
  <h3>Correct member contact (Admin only)</h3>
  <p>Verify the member identity outside the application before making a correction.
   Existing sessions are revoked; member ID, referral, matrix and wallet are unchanged.</p>
  <label>Email<input type="email" maxLength={191} autoComplete="off" required value={email}
   onChange={event=>setEmail(event.target.value)}/></label>
  <label>Mobile (country code required)
   <input type="tel" maxLength={16} pattern="[+][1-9][0-9]{7,14}" autoComplete="off"
    placeholder="+919876543210" value={mobile} onChange={event=>setMobile(event.target.value)}/>
  </label>
  <label>Reason and identity verification reference
   <textarea required minLength={8} maxLength={500} value={reason}
    onChange={event=>setReason(event.target.value)}/>
  </label>
  {error&&<p role="alert" className="admin-error">{error}</p>}
  <button className="button" disabled={busy||reason.trim().length<8} type="submit">
   {busy?'Saving…':'Save verified contact correction'}
  </button>
 </form>;
}
