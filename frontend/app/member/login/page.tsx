import Link from 'next/link';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {memberUiEnabled} from '@/lib/member-session';
import {MemberAuthForm} from '@/components/member-auth-form';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Member sign in',robots:{index:false,follow:false}};
export default function LoginPage(){
 if(!memberUiEnabled())notFound();
 return <main id="main-content" className="admin-shell"><div className="admin-auth">
  <p className="eyebrow">Nonfinancial membership application</p><h1>Member sign in</h1>
  <MemberAuthForm mode="login"/>
  <p><Link href="/member/register">Apply for membership</Link></p>
 </div></main>;
}
