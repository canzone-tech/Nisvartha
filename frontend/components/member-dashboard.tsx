'use client';
import {useRouter} from 'next/navigation';
import {FormEvent,useState} from 'react';
type Member={id:string;email:string;displayName:string;status:string;communicationOptIn:boolean;
 application:{id:string;status:string;termsVersion:string;privacyVersion:string;createdAt:string;decisionReason:string|null}|null};
export function MemberDashboard({initial}:{initial:Member}){
 const router=useRouter();
 const [name,setName]=useState(initial.displayName),[optIn,setOptIn]=useState(initial.communicationOptIn);
 const [password,setPassword]=useState(''),[newPassword,setNewPassword]=useState('');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 async function action(path:string,payload:object={}){
  setError('');setNotice('');setBusy(true);
  try{
   const result=await fetch('/api/member/actions/'+path,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
   });
   const body=await result.json().catch(()=>null);
   if(!result.ok)throw Error(body?.message||'Operation denied');
   router.refresh();return true;
  }catch(e){setError(e instanceof Error?e.message:'Operation denied');return false}
  finally{setBusy(false)}
 }
 async function logout(){
  await fetch('/api/member/session/logout',{method:'POST'});
  router.replace('/member/login');router.refresh();
 }
 async function saveProfile(e:FormEvent){e.preventDefault();if(await action('profile',{displayName:name,communicationOptIn:optIn}))setNotice('Profile updated')}
 async function changePassword(e:FormEvent){e.preventDefault();if(await action('password',{currentPassword:password,newPassword})){await logout()}}
 return <div className="cms-workspace">
  <section className="admin-panel"><h2>Application status</h2>
   <p><strong>{initial.application?.status||'No application'}</strong> · Account: {initial.status}</p>
   <p>Applied under terms {initial.application?.termsVersion} and privacy notice {initial.application?.privacyVersion}</p>
   {initial.application?.decisionReason&&<p>Reviewer feedback: {initial.application.decisionReason}</p>}
   <p>No fees, referral earnings, wallet, E-PIN or financial privileges are available through this portal.</p>
  </section>
  {error&&<p role="alert" className="admin-error">{error}</p>}{notice&&<p role="status" className="admin-success">{notice}</p>}
  <section className="admin-panel"><h2>Profile</h2><form className="admin-form" onSubmit={saveProfile}>
   <p>Email: {initial.email}</p>
   <label>Display name<input value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={120} required/></label>
   <label className="media-consent"><input type="checkbox" checked={optIn} onChange={e=>setOptIn(e.target.checked)}/> Receive optional Foundation updates</label>
   <button className="button" type="submit" disabled={busy}>Save profile</button>
  </form></section>
  <section className="admin-panel"><h2>Security</h2><form className="admin-form" onSubmit={changePassword}>
   <label>Current password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label>
   <label>New password<input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} minLength={14} maxLength={128} autoComplete="new-password" required/></label>
   <button className="button" disabled={busy}>Change password (sign out all sessions)</button>
  </form>
  <button className="button alt" onClick={()=>void logout()} disabled={busy}>Sign out</button></section>
  {['SUBMITTED','UNDER_REVIEW','APPROVED'].includes(initial.application?.status||'')&&
   <section className="admin-panel"><h2>Withdraw application</h2>
    <p>This disables account access and revokes sessions. Contact the Foundation for any legal data-retention requests.</p>
    <button className="button alt" disabled={busy} onClick={async()=>{
     if(!window.confirm('Withdraw this membership application?'))return;
     if(await action('withdraw'))await logout();
    }}>Withdraw application</button>
   </section>}
 </div>;
}
