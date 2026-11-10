'use client';
import {FormEvent,useState} from 'react';
import {useRouter} from 'next/navigation';
export function AdminLoginForm(){
 const router=useRouter();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError('');
  const form=new FormData(e.currentTarget);
  try{
   const res=await fetch('/api/admin/session/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.get('email'),password:form.get('password')})});
   if(!res.ok)throw new Error('Sign in failed. Check your credentials or ask an administrator.');
   const result=await res.json() as {passwordChangeRequired?:boolean};
    router.replace(result.passwordChangeRequired===true?'/admin/password':'/admin');router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Unable to sign in');}finally{setBusy(false)}
 }
 return <form onSubmit={submit} className="admin-form">
  <label>Staff email <input type="email" name="email" autoComplete="username" required maxLength={191}/></label>
  <label>Password <input type="password" name="password" autoComplete="current-password" required/></label>
  {error&&<p role="alert">{error}</p>}
  <button className="button" type="submit" disabled={busy}>{busy?'Signing in…':'Sign in'}</button>
 </form>;
}
