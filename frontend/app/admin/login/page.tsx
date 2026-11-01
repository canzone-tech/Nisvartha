import type {Metadata} from 'next';
import {AdminLoginForm} from '@/components/admin-login-form';
export const metadata:Metadata={title:'Staff sign in',robots:{index:false,follow:false}};
export default function StaffLoginPage(){
 return <main id="main-content" className="admin-shell">
  <section className="admin-auth"><p className="eyebrow">Authorized Foundation Staff</p><h1>Staff sign in</h1>
   <p>This area is for approved content editors, reviewers, auditors and administrators. Member registration is not available here.</p>
   <AdminLoginForm/>
  </section>
 </main>;
}
