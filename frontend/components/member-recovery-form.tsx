'use client';
import {FormEvent,useState} from 'react';
import Link from 'next/link';
import {PasswordInput} from './password-input';
export function MemberRecoveryForm(){
 const [code,setCode]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(false);
 async function submit(e:FormEvent){
  e.preventDefault();setBusy(true);setError('');
  try{
   const res=await fetch('/api/member/recovery/redeem',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({code,newPassword:password})});
   const body=await res.json().catch(()=>null);
   if(!res.ok)throw Error(body?.message||'Recovery code invalid or expired');
   setCode('');setPassword('');setSuccess(true);
  }catch(e){setError(e instanceof Error?e.message:'Password reset failed')}
  finally{setBusy(false)}
 }
 if(success)return <div role="status" className="admin-success"><p>Password changed and previous sessions revoked.</p><Link href="/member/login">Return to sign in</Link></div>;
 return <form className="admin-form" onSubmit={submit}>
  <PasswordInput label="One-time recovery code provided after staff identity verification"
   autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)}
   minLength={43} maxLength={43} required/>
  <PasswordInput label="New password" autoComplete="new-password" value={password}
   onChange={e=>setPassword(e.target.value)} minLength={14} maxLength={128} required/>
  {error&&<p role="alert" className="admin-error">{error}</p>}
  <button type="submit" className="button" disabled={busy}>Reset password</button>
 </form>;
}
