'use client';
import {FormEvent,useState} from 'react';
import {useRouter} from 'next/navigation';
type Mode='register'|'login';
export function MemberAuthForm({mode,termsVersion,privacyVersion,registrationPinEnabled=false,autoActivate=false,initialInviteCode=''}:{
 mode:Mode;termsVersion?:string;privacyVersion?:string;registrationPinEnabled?:boolean;autoActivate?:boolean;initialInviteCode?:string
}){
 const router=useRouter();
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();const formElement=e.currentTarget;setBusy(true);setError('');setNotice('');
  const form=new FormData(e.currentTarget);
  const payload=mode==='login'?
   {identifier:form.get('identifier'),password:form.get('password')}:
   {email:form.get('email'),mobile:form.get('mobile'),displayName:form.get('displayName'),password:form.get('password'),
    communicationOptIn:form.get('communicationOptIn')==='on',consent:form.get('consent')==='on',
    termsVersion,privacyVersion,
    ...(registrationPinEnabled?{
     registrationPin:String(form.get('registrationPin')??'').trim(),
     ...(form.get('inviteCode')?{inviteCode:form.get('inviteCode')}:{})
    }:{})};
  try{
   const response=await fetch('/api/member/session/'+mode,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
   });
   const result=await response.json().catch(()=>null);
   if(!response.ok)throw Error(Array.isArray(result?.message)?result.message.join(', '):result?.message||'Request failed');
   if(mode==='register'){
    setNotice(result?.status==='APPROVED'?'Membership active. Sign in to continue.':'Registration submitted. Sign in to view its status.');
    formElement.reset();
   }else{router.replace('/member');router.refresh()}
  }catch(e){setError(e instanceof Error?e.message:'Unable to process request')}
  finally{setBusy(false)}
 }
 return <form className="admin-form" onSubmit={submit}>
  {mode==='register'&&<label>Full display name<input name="displayName" required minLength={2} maxLength={120} autoComplete="name"/></label>}
  {mode==='login'?<label>Email or referral code<input name="identifier" required type="text" maxLength={191} autoComplete="username"/></label>:
   <label>Email<input name="email" required type="email" maxLength={191} autoComplete="email"/></label>}
  {mode==='register'&&<label>Mobile number (with country code)
   <input name="mobile" required type="tel" autoComplete="tel" inputMode="tel"
    pattern="[+][1-9][0-9]{7,14}" maxLength={16} placeholder="+919876543210"/>
  </label>}
  <label>Password<input name="password" required type="password" minLength={mode==='register'?14:1} maxLength={128}
   autoComplete={mode==='register'?'new-password':'current-password'}/></label>
  {mode==='register'&&<>
   {registrationPinEnabled&&<>
    <label>Registration E-PIN
     <input name="registrationPin" pattern="[A-Za-z0-9_-]{43}" autoComplete="off" required/>
    </label>
    {registrationPinEnabled&&<label>{autoActivate?'Referral code':'Inviter code (optional)'}
     <input name="inviteCode" pattern="(?:[A-Za-z0-9]{8}|[A-Za-z0-9_-]{22})" autoComplete="off" defaultValue={initialInviteCode} required={autoActivate}/>
    </label>}
   </>}
   {!autoActivate&&<p className="review-notice">Membership activation follows registration review.</p>}
   <label className="media-consent"><input name="consent" type="checkbox" required/> I agree to the approved membership terms ({termsVersion}) and privacy notice ({privacyVersion}).</label>
   <label className="media-consent"><input name="communicationOptIn" type="checkbox"/> I want optional Foundation updates.</label>
  </>}
  {error&&<p role="alert" className="admin-error">{error}</p>}
  {notice&&<p role="status" className="admin-success">{notice}</p>}
  <button className="button" type="submit" disabled={busy}>{busy?'Processing…':mode==='register'?'Register':'Sign in'}</button>
 </form>;
}
