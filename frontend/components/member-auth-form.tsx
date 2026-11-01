'use client';
import {FormEvent,useState} from 'react';
import {useRouter} from 'next/navigation';
type Mode='register'|'login';
export function MemberAuthForm({mode,termsVersion,privacyVersion}:{mode:Mode;termsVersion?:string;privacyVersion?:string}){
 const router=useRouter();
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();const formElement=e.currentTarget;setBusy(true);setError('');setNotice('');
  const form=new FormData(e.currentTarget);
  const payload=mode==='login'?
   {email:form.get('email'),password:form.get('password')}:
   {email:form.get('email'),displayName:form.get('displayName'),password:form.get('password'),
    communicationOptIn:form.get('communicationOptIn')==='on',consent:form.get('consent')==='on',
    termsVersion,privacyVersion};
  try{
   const response=await fetch('/api/member/session/'+mode,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
   });
   const result=await response.json().catch(()=>null);
   if(!response.ok)throw Error(Array.isArray(result?.message)?result.message.join(', '):result?.message||'Request failed');
   if(mode==='register'){
    setNotice('Application submitted for staff review. There is no fee, E-PIN or financial entitlement. Please sign in to view your status.');
    formElement.reset();
   }else{router.replace('/member');router.refresh()}
  }catch(e){setError(e instanceof Error?e.message:'Unable to process request')}
  finally{setBusy(false)}
 }
 return <form className="admin-form" onSubmit={submit}>
  {mode==='register'&&<label>Full display name<input name="displayName" required minLength={2} maxLength={120} autoComplete="name"/></label>}
  <label>Email<input name="email" required type="email" maxLength={191} autoComplete="email"/></label>
  <label>Password<input name="password" required type="password" minLength={mode==='register'?14:1} maxLength={128}
   autoComplete={mode==='register'?'new-password':'current-password'}/></label>
  {mode==='register'&&<>
   <p className="review-notice">Submitting an application does not grant membership approval, joining privileges or a financial benefit.</p>
   <label className="media-consent"><input name="consent" type="checkbox" required/> I agree to the approved membership terms ({termsVersion}) and privacy notice ({privacyVersion}).</label>
   <label className="media-consent"><input name="communicationOptIn" type="checkbox"/> I want optional Foundation updates.</label>
  </>}
  {error&&<p role="alert" className="admin-error">{error}</p>}
  {notice&&<p role="status" className="admin-success">{notice}</p>}
  <button className="button" type="submit" disabled={busy}>{busy?'Processing…':mode==='register'?'Submit membership application':'Sign in'}</button>
 </form>;
}
