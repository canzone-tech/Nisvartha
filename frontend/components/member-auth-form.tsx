'use client';
import {FormEvent,useState} from 'react';
import {useRouter} from 'next/navigation';
type Mode='register'|'login';
export function MemberAuthForm({mode,termsVersion,privacyVersion,registrationPinEnabled=false,autoActivate=false,initialInviteCode=''}:{
 mode:Mode;termsVersion?:string;privacyVersion?:string;registrationPinEnabled?:boolean;autoActivate?:boolean;initialInviteCode?:string
}){
 const router=useRouter();
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [issuedCode,setIssuedCode]=useState(''),[copyStatus,setCopyStatus]=useState('');
 async function copyCode(){
  try{await navigator.clipboard.writeText(issuedCode);setCopyStatus('Referral code copied. Save it securely.');}
  catch{setCopyStatus('Clipboard unavailable. Select and copy the code above.');}
 }
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();const formElement=e.currentTarget;setBusy(true);setError('');setNotice('');setIssuedCode('');setCopyStatus('');
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
    if(typeof result?.referralCode!=='string'||!/^(?:[A-Z0-9]{8}|[A-Za-z0-9_-]{22})$/.test(result.referralCode))
     throw new Error('Registration succeeded, but no login code was returned. Contact Admin with your application reference.');
    setIssuedCode(result.referralCode);
    setNotice(result?.status==='APPROVED'?'Membership active. Save your code before signing in.':'Registration submitted. Save your code to access your account.');
    formElement.reset();
   }else{router.replace('/member');router.refresh()}
  }catch(e){setError(e instanceof Error?e.message:'Unable to process request')}
  finally{setBusy(false)}
 }
 return <form className="admin-form" onSubmit={submit}>
  {mode==='register'&&<label>Full display name<input name="displayName" required minLength={2} maxLength={120} autoComplete="name"/></label>}
  {mode==='login'?<label>Referral code<input name="identifier" required type="text" maxLength={22} pattern="(?:[A-Za-z0-9]{8}|[A-Za-z0-9_-]{22})" autoComplete="username"/></label>:
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
  {issuedCode&&<section className="admin-panel" aria-label="Your new member login code">
   <h2>Registration successful — save your referral code</h2>
   <p>This code is your unique login ID and can also be shared as a sponsor when eligible. Sign in with this code and your password, not email or mobile.</p>
   <label>Your referral code<input value={issuedCode} readOnly onFocus={event=>event.currentTarget.select()} aria-label="Your new referral code"/></label>
   <button type="button" className="button alt" onClick={()=>void copyCode()}>Copy referral code</button>
   <p>Copy and save this code securely before leaving this page.</p>
   {copyStatus&&<p role="status">{copyStatus}</p>}
  </section>}
  <button className="button" type="submit" disabled={busy}>{busy?'Processing…':mode==='register'?'Register':'Sign in'}</button>
 </form>;
}
