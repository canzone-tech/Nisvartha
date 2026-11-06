'use client';
import {useState,useSyncExternalStore} from 'react';
import {referralLink,whatsappReferralShareUrl} from '@/lib/referral-share';

// Stable browser-only origin snapshot; server renders an empty read-only URL
// and hydration obtains the actual local/test origin without effect-driven state.
const subscribe=()=>()=>{};
const browserOrigin=()=>window.location.origin;
const serverOrigin=()=>'';

export function MemberReferralShare({code}:{code:string}){
 const origin=useSyncExternalStore(subscribe,browserOrigin,serverOrigin);
 const url=origin?referralLink(origin,code):'';
 const [message,setMessage]=useState('');
 const isLocal=Boolean(url)&&/^http:\/\/(127\.0\.0\.1|localhost)(?::\d+)?\//.test(url);
 async function copy(){
  if(!url)return;
  try{
   await navigator.clipboard.writeText(url);
   setMessage('Invitation link copied. Send registration E-PIN separately.');
  }catch{
   setMessage('Clipboard unavailable; select and copy the invitation URL below.');
  }
 }
 const whatsapp=url?whatsappReferralShareUrl(url):null;
 return <section className="admin-panel foundation-member-invite-share" aria-label="Share your invitation">
  <h2>Share your invitation</h2>
  <p>Nonfinancial invitation only. The link pre-fills your inviter code; an applicant
   still needs a separate valid registration E-PIN and Admin review.</p>
  <p><strong>Your inviter code</strong> <code>{code}</code></p>
  <label htmlFor="member-invitation-url">Your invitation link</label>
  <input id="member-invitation-url" type="text" value={url} readOnly
   onFocus={event=>event.currentTarget.select()} aria-label="Your invitation link"/>
  <div className="foundation-member-invite-actions">
   <button type="button" className="button" onClick={()=>void copy()} disabled={!url}>
    Copy invitation link
   </button>
   {whatsapp&&<a className="button green" href={whatsapp} target="_blank"
    rel="noopener noreferrer" aria-label="Share invitation using WhatsApp">
    Share via WhatsApp
   </a>}
  </div>
  {message&&<p role="status">{message}</p>}
  {isLocal&&<p className="foundation-admin-footnote">Local UAT URL: it only works on this device.
   Do not send this localhost link to someone outside your test environment.</p>}
  <p className="foundation-admin-footnote">
   No paid joining, recruitment rewards, commissions, wallets or payouts are enabled.
  </p>
 </section>;
}
