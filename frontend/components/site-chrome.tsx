'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {SiteHeader} from './site-header';

function PublicFooter(){
 return <>
  <footer className="footer client-footer"><div className="container">
   <div className="footgrid">
    <div><h3>Nisvartha Foundation</h3>
     <p>Together for a Brighter Tomorrow. Learn about Foundation initiatives, community participation and ways to connect.</p>
    </div>
    <div><h3>Explore</h3><p>
     <Link href="/about">About Us</Link><br/>
     <Link href="/projects">Projects</Link><br/>
     <Link href="/go-green">Go Green</Link><br/>
     <Link href="/volunteer">Volunteer</Link>
    </p></div>
    <div><h3>Information</h3><p>
     <Link href="/privacy-policy">Privacy Policy</Link><br/>
     <Link href="/terms">Terms of Use</Link><br/>
     <Link href="/contact">Contact</Link><br/>
     <Link href="/member/login">Member Login</Link>
    </p></div>
   </div>
   <div className="client-member-access"><h3>Member Access</h3><p>
    <Link href="/member/login">Login</Link><br/>
    <Link href="/member/register">Register</Link>
   </p></div>
   <div className="copyright">© {new Date().getFullYear()} Nisvartha Foundation. All rights reserved.</div>
  </div></footer>
 </>;
}

/** Preserve the approved public source, with independent account navigation. */
export function SiteChrome({children}:{children:React.ReactNode}){
 const path=usePathname();
 const isAdmin=path==='/admin'||path.startsWith('/admin/');
 const isMember=path==='/member'||path.startsWith('/member/');
 if(isAdmin||isMember)return <>
  <header className="internal-topbar"><div className="internal-topbar-inner">
   <Link href={isAdmin?'/admin':'/member'} className="internal-brand">
    <span className="internal-brand-mark" aria-hidden="true">✦</span>
    <span>NISVARTHA<small>FOUNDATION</small></span>
   </Link>
   <span className="internal-area">{isAdmin?'Administration':'Member portal'}</span>
   <nav aria-label="Account navigation">
    <Link href={isAdmin?'/admin':'/member'}>Dashboard</Link>
    <Link href="/">Public website</Link>
   </nav>
  </div></header>
  {children}
 </>;
 return <><SiteHeader/>{children}<PublicFooter/></>;
}
