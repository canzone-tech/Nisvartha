'use client';
import {FormEvent,useState} from 'react';

export function StaffAssistedRegistrationPanel({termsVersion,privacyVersion,registrationPinEnabled=false,autoActivate=false}:{
 termsVersion:string;privacyVersion:string;registrationPinEnabled?:boolean;autoActivate?:boolean
}){
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const [isRoot,setIsRoot]=useState(false);
 const root=autoActivate&&isRoot;
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy)return;
  const formElement=event.currentTarget;
  const values=new FormData(formElement);
  setBusy(true);setError('');setSuccess('');
  try{
   const response=await fetch(root?'/api/admin/backend/cms/membership/root':
    '/api/admin/backend/cms/membership/applications/register',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
     displayName:values.get('displayName'),email:values.get('email'),
     password:values.get('password'),termsVersion,privacyVersion,
     consent:values.get('consent')==='on',
     communicationOptIn:values.get('communicationOptIn')==='on',
     applicantPresent:values.get('applicantPresent')==='on',
     ...(registrationPinEnabled&&!root?{
      registrationPin:String(values.get('registrationPin')??'').trim(),
      ...(values.get('inviteCode')?{inviteCode:values.get('inviteCode')}: {})
     }: {})
    })
   });
   const result=await response.json().catch(()=>null);
   if(!response.ok)throw new Error(Array.isArray(result?.message)?result.message.join(', '):
    typeof result?.message==='string'?result.message:'Registration rejected');
   if(!['SUBMITTED','APPROVED'].includes(result?.status)||
    typeof result.applicationReference!=='string')
    throw new Error('Unexpected registration response');
   setSuccess(result.status==='APPROVED'?
    (root?'Root member':'Member')+' registered and active.':
    'Registration submitted. Reference: '+result.applicationReference);
   formElement.reset();
   setIsRoot(false);
  }catch(err){setError(err instanceof Error?err.message:'Unable to register member')}
  finally{setBusy(false)}
 }
 return <section className="admin-panel">
  <h2>Register member</h2>
  <p>The member should be present and choose their own password.</p>
  {autoActivate&&<label className="media-consent">
   <input type="checkbox" checked={isRoot} disabled={busy}
    onChange={event=>setIsRoot(event.target.checked)}/>
   Create the first root member (one time only)
  </label>}
  <form className="admin-form" onSubmit={submit}>
   <label>Member name
    <input name="displayName" minLength={2} maxLength={120} autoComplete="name" required/>
   </label>
   <label>Email
    <input name="email" type="email" maxLength={191} autoComplete="email" required/>
   </label>
   <label>Member password
    <input name="password" type="password" minLength={14} maxLength={128}
     autoComplete="new-password" required/>
   </label>
   {registrationPinEnabled&&!root&&<>
    <label>Registration E-PIN
     <input name="registrationPin" pattern="[A-Za-z0-9_-]{43}" autoComplete="off" required/>
    </label>
    <label>Referral code{!autoActivate?' (optional)':''}
     <input name="inviteCode" pattern="(?:[A-Za-z0-9]{8}|[A-Za-z0-9_-]{22})"
      autoComplete="off" required={autoActivate}/>
    </label>
   </>}
   <label className="media-consent">
    <input name="applicantPresent" type="checkbox" required/>
    Member is present and enters their own password.
   </label>
   <label className="media-consent">
    <input name="consent" type="checkbox" required/>
    Member agrees to the <a href="/terms" target="_blank" rel="noopener noreferrer">membership terms</a> and
    <a href="/privacy-policy" target="_blank" rel="noopener noreferrer"> privacy notice</a>.
   </label>
   <label className="media-consent">
    <input name="communicationOptIn" type="checkbox"/>
    Receive optional Foundation updates.
   </label>
   {error&&<p role="alert" className="admin-error">{error}</p>}
   {success&&<p role="status" className="admin-success">{success}</p>}
   <button className="button" type="submit" disabled={busy}>
    {busy?'Registering…':root?'Create root member':'Register member'}
   </button>
  </form>
 </section>;
}
