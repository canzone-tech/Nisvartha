import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import Link from 'next/link';
import {memberUiEnabled} from '@/lib/member-session';
import {MemberRecoveryForm} from '@/components/member-recovery-form';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Verified member password recovery',robots:{index:false,follow:false,noarchive:true}};
export default function RecoveryPage(){
 if(!memberUiEnabled()||process.env.MEMBER_RECOVERY_ENABLED!=='true')notFound();
 return <main id="main-content" className="admin-shell">
  <div className="admin-auth"><p className="eyebrow">Account security</p><h1>Recover member account</h1>
   <p>Contact an authorized Foundation administrator to verify your identity and receive a one-time code. Codes expire after 15 minutes.</p>
   <MemberRecoveryForm/><p><Link href="/member/login">Back to sign in</Link></p>
  </div>
 </main>;
}
