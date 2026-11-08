'use client';
import {FormEvent,useState} from 'react';
export function StaffAssistedRegistrationPanel({termsVersion,privacyVersion,uatPinEnabled=false,accessPinEnabled=false}:{
 termsVersion:string;privacyVersion:string;uatPinEnabled?:boolean;accessPinEnabled?:boolean
}){
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const formElement=event.currentTarget;
  const values=new FormData(formElement);
  setBusy(true);setError('');setSuccess('');
  try{
   const response=await fetch('/api/admin/backend/cms/membership/applications/register',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
     displayName:values.get('displayName'),email:values.get('email'),
     password:values.get('password'),termsVersion,privacyVersion,
     consent:values.get('consent')==='on',
     communicationOptIn:values.get('communicationOptIn')==='on',
     applicantPresent:values.get('applicantPresent')==='on',
     ...((uatPinEnabled||accessPinEnabled)?{
      registrationPin:values.get('registrationPin'),
      ...(values.get('inviteCode')?{inviteCode:values.get('inviteCode')}: {})
     }: {})
    })
   });
   const result=await response.json().catch(()=>null);
   if(!response.ok)throw new Error(Array.isArray(result?.message)?result.message.join(', '):
    typeof result?.message==='string'?result.message:'Registration rejected');
   if(result?.status!=='SUBMITTED'||typeof result.applicationReference!=='string')
    throw new Error('Unexpected membership application response');
   setSuccess('Application submitted for offline transaction verification and review. Reference: '+result.applicationReference);
   formElement.reset();
  }catch(err){setError(err instanceof Error?err.message:'Unable to submit application')}
  finally{setBusy(false)}
 }
 return <section className="admin-panel">
  <h2>Register member (staff-assisted)</h2>
  <p>For a present, consenting applicant only. Applicant enters their own password.
   Registration remains pending until Admin verifies the offline ₹15,000 transaction and approves activation.</p>
  <form className="admin-form" onSubmit={submit}>
   <label>Applicant full name
    <input name="displayName" minLength={2} maxLength={120} autoComplete="name" required/>
   </label>
   <label>Applicant email
    <input name="email" type="email" maxLength={191} autoComplete="email" required/>
   </label>
   <label>Applicant-chosen password (14 characters minimum)
    <input name="password" type="password" minLength={14} maxLength={128}
     autoComplete="new-password" required/>
   </label>
   {(uatPinEnabled||accessPinEnabled)&&<>
    <label>{uatPinEnabled?'Synthetic registration E-PIN':'Registration E-PIN'}
     <input name="registrationPin" pattern="[A-Za-z0-9_-]{43}" autoComplete="off" required/>
    </label>
    {(uatPinEnabled||accessPinEnabled)&&<label>Inviter code (optional)
     <input name="inviteCode" pattern="[A-Za-z0-9_-]{22}" autoComplete="off"/>
    </label>}
   </>}
   <p>Approved membership terms: {termsVersion}. Privacy notice: {privacyVersion}.</p>
   <label className="media-consent">
    <input name="applicantPresent" type="checkbox" required/>
    Applicant is present and enters their own password.
   </label>
   <label className="media-consent">
    <input name="consent" type="checkbox" required/>
    Applicant has reviewed and consented to the approved terms and privacy notice.
   </label>
   <label className="media-consent">
    <input name="communicationOptIn" type="checkbox"/>
    Applicant separately opted in to optional Foundation updates.
   </label>
   {error&&<p role="alert" className="admin-error">{error}</p>}
   {success&&<p role="status" className="admin-success">{success}</p>}
   <button className="button" type="submit" disabled={busy}>
    {busy?'Submitting…':'Submit pending application'}
   </button>
  </form>
 </section>;
}
