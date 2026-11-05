'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {FormEvent,useState} from 'react';
import {GenealogyTree} from './genealogy-tree';
import {MemberReferralShare} from './member-referral-share';
import {UatScenarioView} from './uat-scenario-view';
import type {UatScenario} from './uat-scenario-view';
import type {GenealogyView} from './genealogy-tree';

export type Member={id:string;email:string;displayName:string;status:string;communicationOptIn:boolean;
 referralCode?:string|null;invitedCount?:number;
 application:{id:string;status:string;termsVersion:string;privacyVersion:string;createdAt:string;decisionReason:string|null}|null};
type MemberView='overview'|'application'|'profile'|'security'|'invitations'|'financial';
const mainViews:ReadonlyArray<{view:MemberView;label:string}>=[
 {view:'overview',label:'Dashboard'},
 {view:'application',label:'Application status'},
 {view:'profile',label:'My profile'},
 {view:'security',label:'Security'}
];

export function MemberDashboard({initial,genealogy,scenario}:{initial:Member;genealogy?:GenealogyView|null;scenario?:UatScenario|null}){
 const router=useRouter();
 const [view,setView]=useState<MemberView>('overview');
 const [name,setName]=useState(initial.displayName),[optIn,setOptIn]=useState(initial.communicationOptIn);
 const [password,setPassword]=useState(''),[newPassword,setNewPassword]=useState('');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const canSeeInvitations=Boolean(initial.referralCode||genealogy);
 const applicationStatus=initial.application?.status||'No application';

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
 async function saveProfile(e:FormEvent){
  e.preventDefault();
  if(await action('profile',{displayName:name,communicationOptIn:optIn}))setNotice('Profile updated');
 }
 async function changePassword(e:FormEvent){
  e.preventDefault();
  if(await action('password',{currentPassword:password,newPassword}))await logout();
 }
 const navButton=(item:{view:MemberView;label:string})=><button key={item.view} type="button"
  className={'foundation-admin-nav-link foundation-member-nav-button'+(view===item.view?' active':'')}
  aria-pressed={view===item.view} onClick={()=>{setView(item.view);setError('');setNotice('')}}>
  {item.label}
 </button>;
 return <>
  <header className="foundation-admin-header">
   <div>
    <p className="eyebrow">Membership workspace</p>
    <h1>{view==='overview'?'Member dashboard':
      view==='application'?'Application status':
      view==='profile'?'My profile':
      view==='security'?'Account security':
      view==='financial'?'Financial UAT':'Invitations'}</h1>
    <p className="foundation-admin-subtitle">Your application, profile and account security in one place.</p>
   </div>
   <div className="foundation-admin-account">
    <span title={initial.email}>{initial.email}</span>
    <button type="button" className="button alt" disabled={busy} onClick={()=>void logout()}>Sign out</button>
   </div>
  </header>
  <div className="foundation-admin-layout">
   <aside className="foundation-admin-sidebar foundation-member-sidebar">
    <nav aria-label="Member workspace navigation">
     <div className="foundation-admin-nav-group">
      <p>Main workspace</p>
      {mainViews.map(navButton)}
     </div>
     {canSeeInvitations&&<div className="foundation-admin-nav-group">
      <p>Community</p>
      {navButton({view:'invitations',label:'Invitations'})}
      {scenario&&navButton({view:'financial',label:'Financial UAT'})}
     </div>}
    </nav>
    <Link href="/" className="foundation-admin-public-link">
     View public website <span aria-hidden="true">↗</span>
    </Link>
   </aside>
   <div className="foundation-admin-main foundation-member-main" data-member-view={view}>
    {error&&<p role="alert" className="admin-error">{error}</p>}
    {notice&&<p role="status" className="admin-success">{notice}</p>}

    {view==='overview'&&<>
     <section className="foundation-admin-welcome">
      <p className="eyebrow">Nisvartha Foundation</p>
      <h2>Your membership at a glance</h2>
      <p>View your application status and manage your profile. No financial services are active.</p>
     </section>
     <section aria-label="Your membership summary">
      <h2 className="foundation-admin-section-title">At a glance</h2>
      <div className="foundation-admin-stats foundation-member-stats">
       <div><strong>{applicationStatus}</strong><span>Application status</span></div>
       <div><strong>{initial.status}</strong><span>Account status</span></div>
       {canSeeInvitations&&<div><strong>{initial.invitedCount??0}</strong><span>Attributed applications</span></div>}
      </div>
     </section>
     <section aria-label="Member workspace shortcuts">
      <h2 className="foundation-admin-section-title">Where would you like to go?</h2>
      <div className="foundation-admin-shortcuts">
       {mainViews.filter(item=>item.view!=='overview').map(item=>
        <button className="foundation-admin-shortcut foundation-member-shortcut" type="button"
         key={item.view} onClick={()=>setView(item.view)}>
         <strong>{item.label}</strong>
         <span>{item.view==='application'?'Review your latest decision and feedback':
           item.view==='profile'?'Update your display name and communication preferences':
           'Change your password and manage account safety'}</span>
         <span className="foundation-admin-shortcut-arrow" aria-hidden="true">→</span>
        </button>)}
       {canSeeInvitations&&<button className="foundation-admin-shortcut foundation-member-shortcut"
        type="button" onClick={()=>setView('invitations')}>
        <strong>Invitations</strong><span>View nonfinancial invitation activity</span>
        <span className="foundation-admin-shortcut-arrow" aria-hidden="true">→</span>
       </button>}
      </div>
     </section>
     {canSeeInvitations&&initial.referralCode&&<MemberReferralShare code={initial.referralCode}/>}
     {scenario&&<UatScenarioView scenario={scenario}/>}
     <p className="foundation-admin-footnote">No fees, referral earnings, wallet, E-PIN or financial privileges are available through this portal.</p>
     <p className="foundation-admin-footnote">Commission status: NOT ENABLED. Referral counts are nonfinancial and do not create earnings or entitlements.</p>
    </>}

    {view==='application'&&<>
     <section className="admin-panel">
      <h2>Application status</h2>
      <p><strong>{applicationStatus}</strong> · Account: {initial.status}</p>
      {initial.application&&<p>Applied under terms {initial.application.termsVersion} and privacy notice {initial.application.privacyVersion}</p>}
      {initial.application?.decisionReason&&<p>Reviewer feedback: {initial.application.decisionReason}</p>}
      <p>No fees, referral earnings, wallet, E-PIN or financial privileges are available through this portal.</p>
     </section>
     {['SUBMITTED','UNDER_REVIEW','APPROVED'].includes(applicationStatus)&&
      <section className="admin-panel">
       <h2>Withdraw application</h2>
       <p>This disables account access and revokes sessions. Contact the Foundation for any legal data-retention requests.</p>
       <button type="button" className="button alt" disabled={busy} onClick={async()=>{
        if(!window.confirm('Withdraw this membership application?'))return;
        if(await action('withdraw'))await logout();
       }}>Withdraw application</button>
      </section>}
    </>}

    {view==='profile'&&<section className="admin-panel">
     <h2>Profile</h2>
     <form className="admin-form" onSubmit={saveProfile}>
      <p>Email: {initial.email}</p>
      <label>Display name<input value={name} onChange={e=>setName(e.target.value)}
       minLength={2} maxLength={120} required/></label>
      <label className="media-consent"><input type="checkbox" checked={optIn}
       onChange={e=>setOptIn(e.target.checked)}/> Receive optional Foundation updates</label>
      <button className="button" type="submit" disabled={busy}>Save profile</button>
     </form>
    </section>}

    {view==='security'&&<section className="admin-panel">
     <h2>Security</h2>
     <form className="admin-form" onSubmit={changePassword}>
      <label>Current password<input type="password" value={password}
       onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label>
      <label>New password<input type="password" value={newPassword}
       onChange={e=>setNewPassword(e.target.value)} minLength={14} maxLength={128}
       autoComplete="new-password" required/></label>
      <button className="button" type="submit" disabled={busy}>
       Change password (sign out all sessions)
      </button>
     </form>
    </section>}

    {view==='financial'&&scenario&&<UatScenarioView scenario={scenario}/>}

    {view==='invitations'&&canSeeInvitations&&<>
     {initial.referralCode&&<section className="admin-panel">
      <h2>Your nonfinancial invitation code (synthetic UAT)</h2>
      <p>Invite code: <code>{initial.referralCode}</code></p>
      <p>Applications attributed: {initial.invitedCount??0}. No commission or financial entitlement is created.</p>
     </section>}
     {initial.referralCode&&<MemberReferralShare code={initial.referralCode}/>}
     <section className="admin-panel" aria-label="Referral commission availability">
      <h2>Referral commission</h2>
      <p><strong>Not enabled.</strong> This nonfinancial invitation activity does not
       create a payable amount, commission balance, reward or withdrawal right.</p>
     </section>
     {genealogy&&<GenealogyTree tree={genealogy}/>}
    </>}
   </div>
  </div>
 </>;
}
