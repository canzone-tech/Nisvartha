import type {Metadata} from 'next';
import {AdminLoginForm} from '@/components/admin-login-form';
export const metadata:Metadata={title:'Administrator sign in',robots:{index:false,follow:false}};
export default function StaffLoginPage(){
 return <main id="main-content" className="admin-shell">
  <section className="admin-auth"><p className="eyebrow">Nisvartha Administration</p><h1>Admin sign in</h1>
   <p>Only authorized administrators can access member operations. Members must use the member sign-in page.</p>
   <AdminLoginForm/>
  </section>
 </main>;
}
