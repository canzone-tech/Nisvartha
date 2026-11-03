import type {Metadata} from 'next';
import {notFound,redirect} from 'next/navigation';
import {memberFetch,memberUiEnabled} from '@/lib/member-session';
import {MemberDashboard} from '@/components/member-dashboard';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Member application portal',robots:{index:false,follow:false,noarchive:true}};
export default async function MemberPage(){
 if(!memberUiEnabled())notFound();
 const response=await memberFetch('me');
 if(response.status===401)redirect('/member/login');
 if(!response.ok)throw Error('Unable to load member account');
 const member=await response.json();
 return <main id="main-content" className="admin-shell">
  <p className="eyebrow">Nisvartha Foundation</p><h1>Member application portal</h1>
  <MemberDashboard initial={member}/>
 </main>;
}
