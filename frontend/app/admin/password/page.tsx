import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {staffToken} from '@/lib/staff-session';
import {AdminPasswordForm} from '@/components/admin-password-form';
export const metadata:Metadata={title:'Change administrator password',robots:{index:false,follow:false}};
export default async function AdminPasswordPage(){
 if(!await staffToken())redirect('/admin/login');
 return <main id="main-content" className="admin-shell">
  <section className="admin-auth">
   <p className="eyebrow">Nisvartha Administration</p>
   <h1>Set a private administrator password</h1>
   <p>The initial administrator password is temporary. You must replace it before using the Admin workspace. After changing it, sign in again.</p>
   <AdminPasswordForm/>
  </section>
 </main>;
}
