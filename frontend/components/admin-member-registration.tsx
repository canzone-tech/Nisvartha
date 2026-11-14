'use client';
import {FormEvent,useEffect,useState} from 'react';
import {PasswordInput} from './password-input';

export function StaffAssistedRegistrationPanel({termsVersion,privacyVersion,registrationPinEnabled=false,autoActivate=false}:{
 termsVersion:string;privacyVersion:string;registrationPinEnabled?:boolean;autoActivate?:boolean
}){
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const [issuedCode,setIssuedCode]=useState(''),[copyStatus,setCopyStatus]=useState('');
 const [issuedPassword,setIssuedPassword]=useState(''),[registeredName,setRegisteredName]=useState('');
 const [rootStatus,setRootStatus]=useState<{rootCreated:boolean;rootReferralCode:string|null}|null>(null);
 const [rootError,setRootError]=useState('');
 const [inviteCode,setInviteCode]=useState('');
 async function loadRootStatus(){
  const response=await fetch('/api/admin/backend/cms/membership/root/status',{cache:'no-store'});
  const status=await response.json().catch(()=>null);
  if(!response.ok||!status||typeof status.rootCreated!=='boolean'||
   (status.rootReferralCode!==null&&typeof status.rootReferralCode!=='string'))
   throw Error('Unable to verify root member status');
  setRootStatus(status);
  setInviteCode(previous=>previous||status.rootReferralCode||'');
 }
 useEffect(()=>{let live=true;void Promise.resolve().then(async()=>{
  try{
   const response=await fetch('/api/admin/backend/cms/membership/root/status',{cache:'no-store'});
   const status=await response.json().catch(()=>null);
   if(!response.ok||!status||typeof status.rootCreated!=='boolean'||
     (status.rootReferralCode!==null&&typeof status.rootReferralCode!=='string'))
    throw Error('Unable to verify root member');
   if(live){setRootStatus(status);setInviteCode(previous=>previous||status.rootReferralCode||'')}
  }catch(error){if(live)setRootError(error instanceof Error?error.message:'Root lookup unavailable')}
 });return ()=>{live=false}},[]);
 const welcomeMessage=issuedCode&&issuedPassword?
  'Welcome to NISVARTHA Foundation!\nMember: '+registeredName+
  '\nReferral/Login code: '+issuedCode+'\nPassword: '+issuedPassword+
  '\nMember login: '+(typeof window==='undefined'?'https://nisvarthafoundation.in':window.location.origin)+'/member/login'
  :'';
 async function copyWelcome(){
  try{await navigator.clipboard.writeText(welcomeMessage);setCopyStatus('Welcome message copied. Share privately with the member.');}
  catch{setCopyStatus('Clipboard unavailable. Use secure manual delivery.');}
 }
 function shareWelcome(){
  window.open('https://wa.me/?text='+encodeURIComponent(welcomeMessage),'_blank','noopener,noreferrer');
 }
 async function copyCode(){
  try{await navigator.clipboard.writeText(issuedCode);setCopyStatus('Code copied. Provide it securely to the member.');}
  catch{setCopyStatus('Clipboard unavailable. Select and copy the code above.');}
 }
 const [isRoot,setIsRoot]=useState(false);
 const root=autoActivate&&isRoot;
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy)return;
  const formElement=event.currentTarget;
  const values=new FormData(formElement);
  setBusy(true);setError('');setSuccess('');setIssuedCode('');setIssuedPassword('');setRegisteredName('');setCopyStatus('');
  try{
   const response=await fetch(root?'/api/admin/backend/cms/membership/root':
    '/api/admin/backend/cms/membership/applications/register',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
     displayName:values.get('displayName'),mobile:values.get('mobile'),
     password:values.get('password'),termsVersion,privacyVersion,
     consent:values.get('consent')==='on',
     communicationOptIn:values.get('communicationOptIn')==='on',
     applicantPresent:values.get('applicantPresent')==='on',
     ...(registrationPinEnabled&&!root?{
      registrationPin:String(values.get('registrationPin')??'').trim(),
      ...(inviteCode?{inviteCode}: {})
     }: {})
    })
   });
   const result=await response.json().catch(()=>null);
   if(!response.ok)throw new Error(Array.isArray(result?.message)?result.message.join(', '):
    typeof result?.message==='string'?result.message:'Registration rejected');
   if(!['SUBMITTED','APPROVED'].includes(result?.status)||
    typeof result.applicationReference!=='string'||
    typeof result.referralCode!=='string'||!/^(?:[A-Z0-9]{8}|[A-Za-z0-9_-]{22})$/.test(result.referralCode))
    throw new Error('Unexpected registration response');
   setSuccess(result.status==='APPROVED'?
    (root?'Root member':'Member')+' registered and active.':
    'Registration submitted. Reference: '+result.applicationReference);
   setIssuedCode(result.referralCode);
   setIssuedPassword(String(values.get('password')??''));
   setRegisteredName(String(values.get('displayName')??''));
   formElement.reset();
   setIsRoot(false);
   try{await loadRootStatus()}catch{setRootError('Root member status could not be refreshed')}

  }catch(err){setError(err instanceof Error?err.message:'Unable to register member')}
  finally{setBusy(false)}
 }
 return <section className="admin-panel">
  <h2>Register member</h2>
  <p>The member should be present and choose their own password.</p>
  {rootError&&<p role="alert" className="admin-error">{rootError}</p>}
  {autoActivate&&<label className="media-consent">
   <input type="checkbox" checked={isRoot} disabled={busy||!rootStatus||rootStatus.rootCreated}
    onChange={event=>setIsRoot(event.target.checked)}/>
   Create the first root member (one time only) {rootStatus?.rootCreated?'— already created':''}
  </label>}
  <form className="admin-form" onSubmit={submit}>
   <label>Member name
    <input name="displayName" minLength={2} maxLength={120} autoComplete="name" required/>
   </label>
   <label>Mobile number
    <input name="mobile" type="tel" autoComplete="tel-national" inputMode="numeric"
     pattern="[0-9]{10}" minLength={10} maxLength={10} placeholder="9876543210" required/>
   </label>
   <PasswordInput label="Member password (6–12 digits)" name="password" inputMode="numeric"
    pattern="[0-9]{6,12}" minLength={6} maxLength={12}
    autoComplete="new-password" required/>
   {registrationPinEnabled&&!root&&<>
    <label>Registration E-PIN
     <input name="registrationPin" pattern="[A-Za-z0-9_-]{43}" autoComplete="off" required/>
    </label>
    <label>Referral code{!autoActivate?' (optional)':''}
     <input name="inviteCode" pattern="(?:[A-Za-z0-9]{8}|[A-Za-z0-9_-]{22})"
      value={inviteCode} onChange={event=>setInviteCode(event.target.value.toUpperCase())}
      autoComplete="off" required={autoActivate} readOnly={!rootStatus}/>
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
   {issuedCode&&<section className="admin-panel" aria-label="New member referral code">
    <h3>Member registration welcome message</h3>
    <p>One-time delivery only. The password is not retrievable after this screen. WhatsApp and clipboard are not encrypted storage; share privately with the member and ask them to change it after login.</p>
    <label>Referral code<input value={issuedCode} readOnly onFocus={event=>event.currentTarget.select()}/></label>
    <div className="cms-row-actions">
     <button type="button" className="button alt" onClick={()=>void copyCode()}>Copy referral code</button>
     <button type="button" className="button alt" onClick={()=>void copyWelcome()}>Copy welcome message</button>
     <button type="button" className="button alt" onClick={shareWelcome}>Share on WhatsApp</button>
     <button type="button" className="button alt" onClick={()=>{setIssuedCode('');setIssuedPassword('');setRegisteredName('')}}>Dismiss credentials</button>
    </div>
    {copyStatus&&<p role="status">{copyStatus}</p>}
   </section>}
   <button className="button" type="submit" disabled={busy||!rootStatus}>
    {busy?'Registering…':root?'Create root member':'Register member'}
   </button>
  </form>
 </section>;
}
