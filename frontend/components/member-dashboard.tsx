'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {FormEvent,useState} from 'react';
import {GenealogyTree} from './genealogy-tree';
import {MemberReferralShare} from './member-referral-share';
import type {GenealogyView} from './genealogy-tree';
import {MemberMatrixTree} from './member-matrix-tree';
import type {MemberMatrixView} from './member-matrix-tree';
import {MemberEarnings} from './member-earnings';
import type {MemberEarningsView} from './member-earnings';
import {MemberWallet} from './member-wallet';
import {MemberPayoutProfile} from './member-payout-profile';
import type {MemberWalletView} from './member-wallet';

export type Member={id:string;email:string;mobile?:string|null;displayName:string;status:string;communicationOptIn:boolean;
 referralCode?:string|null;invitedCount?:number;
 application:{id:string;status:string;termsVersion:string;privacyVersion:string;createdAt:string;decisionReason:string|null}|null};
type MemberView='overview'|'application'|'profile'|'security'|'invitations'|'matrix'|'earnings'|'wallet';
const mainViews:ReadonlyArray<{view:MemberView;label:string}>=[
 {view:'overview',label:'Dashboard'},
 {view:'application',label:'Application status'},
 {view:'profile',label:'My profile'},
 {view:'security',label:'Security'}
];

export function MemberDashboard({initial,genealogy,matrix,earnings,wallet,autoActivate=false}:{initial:Member;genealogy?:GenealogyView|null;matrix?:MemberMatrixView|null;earnings?:MemberEarningsView|null;wallet?:MemberWalletView|null;autoActivate?:boolean}){
 const router=useRouter();
 const [view,setView]=useState<MemberView>('overview');
 const [name,setName]=useState(initial.displayName),[optIn,setOptIn]=useState(initial.communicationOptIn);
 const [password,setPassword]=useState(''),[newPassword,setNewPassword]=useState('');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const canSeeInvitations=initial.status==='ACTIVE'&&Boolean((initial.referralCode&&initial.invitedCount!==undefined)||genealogy);
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
      view==='earnings'?'Earnings':view==='wallet'?'Wallet':view==='matrix'?'1:3 Auto Pool Matrix':'Invitations'}</h1>
    <p className="foundation-admin-subtitle">{autoActivate?'Your referrals, matrix and account in one place.':'Your application, profile and account security in one place.'}</p>
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
      {mainViews.filter(item=>!autoActivate||item.view!=='application').map(navButton)}
     </div>
     {canSeeInvitations&&<div className="foundation-admin-nav-group">
      <p>Community</p>
      {navButton({view:'invitations',label:'Invitations'})}
      {matrix&&navButton({view:'matrix',label:'1:3 Matrix'})}
      {earnings&&navButton({view:'earnings',label:'Earnings'})}
      {wallet&&navButton({view:'wallet',label:'Wallet & payouts'})}
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
      <p>{autoActivate?'See your referral code, invited members and matrix positions.':'View your application status, profile, invitations, matrix placement and earnings.'}</p>
     </section>
     <section aria-label="Your membership summary">
      <h2 className="foundation-admin-section-title">At a glance</h2>
      <div className="foundation-admin-stats foundation-member-stats">
       {!autoActivate&&<div><strong>{applicationStatus}</strong><span>Application status</span></div>}
       <div><strong>{initial.status}</strong><span>Account status</span></div>
       {canSeeInvitations&&<div><strong>{initial.invitedCount??0}</strong><span>Attributed applications</span></div>}
      </div>
     </section>
     <section aria-label="Member workspace shortcuts">
      <h2 className="foundation-admin-section-title">Where would you like to go?</h2>
      <div className="foundation-admin-shortcuts">
       {mainViews.filter(item=>item.view!=='overview'&&(!autoActivate||item.view!=='application')).map(item=>
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
        <strong>Invitations</strong><span>View invitation activity</span>
        <span className="foundation-admin-shortcut-arrow" aria-hidden="true">→</span>
       </button>}
      </div>
     </section>
     {initial.referralCode&&!canSeeInvitations&&<section className="admin-panel"><h2>Your login code</h2><p><code>{initial.referralCode}</code></p><p>Save this code. Sign in with your referral code and password, not email or mobile. Sponsorship requires an eligible active membership.</p></section>}
     {canSeeInvitations&&initial.referralCode&&<MemberReferralShare code={initial.referralCode}/>}
    
     {earnings&&<p className="foundation-admin-footnote">Offline sale activation and earnings are recorded in the Earnings section. Settlements are completed offline and referenced here.</p>}
    </>}

    {view==='application'&&<>
     <section className="admin-panel">
      <h2>Application status</h2>
      <p><strong>{applicationStatus}</strong> · Account: {initial.status}</p>
      {initial.application&&<p>Applied under terms {initial.application.termsVersion} and privacy notice {initial.application.privacyVersion}</p>}
      {initial.application?.decisionReason&&<p>Reviewer feedback: {initial.application.decisionReason}</p>}
      {earnings?<p>Offline transaction confirmation and earnings are available under Earnings.</p>:
       <p>Financial features are not enabled for this account.</p>}
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
      <p>Mobile: {initial.mobile??'Not recorded (legacy account)'}</p>
      <p>Email and mobile corrections are handled by Admin.</p>
      <label>Display name<input value={name} onChange={e=>setName(e.target.value)}
       minLength={2} maxLength={120} required/></label>
      <label className="media-consent"><input type="checkbox" checked={optIn}
       onChange={e=>setOptIn(e.target.checked)}/> Receive optional Foundation updates</label>
      <button className="button" type="submit" disabled={busy}>Save profile</button>
     </form>
    </section>}

    {view==='profile'&&wallet&&<MemberPayoutProfile/>}

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

    {view==='matrix'&&matrix&&<MemberMatrixTree matrix={matrix}/>} 

    {view==='earnings'&&earnings&&<MemberEarnings data={earnings}/>}
    {view==='wallet'&&wallet&&<MemberWallet data={wallet}/>}

   

    {view==='invitations'&&canSeeInvitations&&<>
     {initial.referralCode&&<section className="admin-panel">
      <h2>Your invitation code</h2>
      <p>Invite code: <code>{initial.referralCode}</code></p>
      <p>Applications attributed: {initial.invitedCount??0}.</p>
     </section>}
     {initial.referralCode&&<MemberReferralShare code={initial.referralCode}/>}
     {earnings&&<section className="admin-panel" aria-label="Direct referral earning">
      <h2>Direct referral</h2>
      <p>₹1,000 is recorded after the invited member&apos;s ₹15,000 offline transaction is confirmed and the member is activated.</p>
     </section>}
     {genealogy&&<GenealogyTree tree={genealogy}/>}
    </>}
   </div>
  </div>
 </>;
}
