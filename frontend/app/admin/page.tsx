import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import {staffFetch} from '@/lib/staff-session';
import {AdminLogoutButton} from '@/components/admin-logout';
import {CmsWorkspace} from '@/components/cms-workspace';
import {StaffManagement} from '@/components/admin-staff-panel';
import {AdminAuditPanel} from '@/components/admin-audit-panel';
import {EnquiryCasePanel} from '@/components/admin-enquiries';
import {AdminMediaPanel} from '@/components/admin-media-panel';
export const metadata:Metadata={title:'Staff workspace',robots:{index:false,follow:false}};
type User={id:string;email:string;role:'ADMIN'|'EDITOR'|'APPROVER'|'AUDITOR'};
export default async function AdminPage(){
 const response=await staffFetch('staff/me');
 if(!response.ok)redirect('/admin/login');
 const user=await response.json() as User;
 return <main id="main-content" className="admin-shell">
  <div className="admin-heading">
   <div><p className="eyebrow">Nisvartha Foundation</p><h1>Content workspace</h1><p>Signed in as {user.email} ({user.role})</p></div>
   <AdminLogoutButton/>
  </div>
  <div className="admin-policy">Content is not public until independently reviewed and approved. Payment, E-PIN and matrix operations are not available in this workspace.</div>
  <CmsWorkspace user={user}/>
  <AdminMediaPanel user={user}/>
  {(user.role==='ADMIN'||user.role==='APPROVER')&&<EnquiryCasePanel user={{id:user.id,role:user.role}}/>}
  {user.role==='ADMIN'&&<StaffManagement/>}
  {(user.role==='ADMIN'||user.role==='AUDITOR')&&<AdminAuditPanel/>}
  <p className="review-notice"><Link href="/">Public homepage</Link> · All publication events are audited.</p>
 </main>;
}
