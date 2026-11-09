import Link from 'next/link';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {memberApplicationsEnabled} from '@/lib/member-session';
import {MemberAuthForm} from '@/components/member-auth-form';
import {INVITE_CODE_PATTERN} from '@/lib/referral-share';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Membership application',robots:{index:false,follow:false}};
type Props={searchParams:Promise<{invite?:string|string[]}>};
export default async function RegisterPage({searchParams}:Props){
 const {invite}=await searchParams;
 const invitationEnabled=process.env.NISVARTHA_UAT_PIN_REGISTRATION==='synthetic'||
  process.env.REGISTRATION_ACCESS_PIN_ENABLED==='true';
 const initialInviteCode=invitationEnabled&&
  typeof invite==='string'&&INVITE_CODE_PATTERN.test(invite)?invite:'';
 const terms=process.env.MEMBER_TERMS_VERSION,privacy=process.env.MEMBER_PRIVACY_VERSION;
 if(!memberApplicationsEnabled()||!terms||!privacy)notFound();
 return <main id="main-content" className="admin-shell"><div className="admin-auth">
  <p className="eyebrow">Membership</p><h1>Membership application</h1>
  <p>Your application is reviewed by authorized Foundation staff. Activation requires a valid registration E-PIN and Admin-confirmed ₹15,000 offline transaction evidence.</p>
  <MemberAuthForm mode="register" termsVersion={terms} privacyVersion={privacy}
   registrationPinEnabled={invitationEnabled}
   initialInviteCode={initialInviteCode}/>
  <p><Link href="/member/login">Already applied? Sign in</Link></p>
 </div></main>;
}
