import Link from 'next/link';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {memberApplicationsEnabled} from '@/lib/member-session';
import {MemberAuthForm} from '@/components/member-auth-form';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Membership application',robots:{index:false,follow:false}};
export default function RegisterPage(){
 const terms=process.env.MEMBER_TERMS_VERSION,privacy=process.env.MEMBER_PRIVACY_VERSION;
 if(!memberApplicationsEnabled()||!terms||!privacy)notFound();
 return <main id="main-content" className="admin-shell"><div className="admin-auth">
  <p className="eyebrow">Nonfinancial application</p><h1>Membership application</h1>
  <p>Your submission is reviewed by authorized Foundation staff. No payment, paid E-PIN or compensation entitlement is involved.</p>
  <MemberAuthForm mode="register" termsVersion={terms} privacyVersion={privacy}
   uatPinEnabled={process.env.NISVARTHA_UAT_PIN_REGISTRATION==='synthetic'}
   accessPinEnabled={process.env.REGISTRATION_ACCESS_PIN_ENABLED==='true'}/>
  <p><Link href="/member/login">Already applied? Sign in</Link></p>
 </div></main>;
}
