import './globals.css';
import './admin-shell.css';
import Link from 'next/link';
import type {Metadata} from 'next';
import {SiteHeader} from '@/components/site-header';
import {PublicChrome} from '@/components/public-chrome';
import {siteUrl} from '@/lib/site';
import {clientStyles} from '@/lib/client-content';
export const metadata:Metadata={
 metadataBase:new URL(siteUrl),
 title:{default:'Nisvartha Foundation',template:'%s | Nisvartha Foundation'},
 description:'Nisvartha Foundation: community initiatives, projects and ways to get involved.',
 robots:{index:false,follow:false}
};
export default function Layout({children}:{children:React.ReactNode}){
 return <html lang="en"><body>
  <a className="skip-link" href="#main-content">Skip to main content</a>
  <PublicChrome>
   <style id="approved-client-styles" dangerouslySetInnerHTML={{__html:clientStyles()}}/>
   <SiteHeader/>
  </PublicChrome>
  {children}
  <PublicChrome><footer className="footer client-footer"><div className="container">
   <div className="footgrid">
    <div><h3>Nisvartha Foundation</h3>
     <p>Together for a Brighter Tomorrow. This prototype presents a framework for sharing verified Foundation information, community initiatives and ways to participate.</p>
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
     <Link href="/member/login">Member Login (demo)</Link>
    </p></div>
   </div>
   <div className="client-member-access"><h3>Member Access</h3><p>
    <Link href="/member/login">Login</Link><br/>
    <Link href="/member/register">Register</Link>
   </p></div>
   <div className="copyright">© {new Date().getFullYear()} Nisvartha Foundation. Prototype website. Verify all legal, registration and programme information before public launch.</div>
  </div></footer></PublicChrome>
 </body></html>;
}
