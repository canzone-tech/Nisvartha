import './globals.css';
import Link from 'next/link';
import type {Metadata} from 'next';
import {SiteHeader} from '@/components/site-header';
import {siteUrl} from '@/lib/site';
export const metadata:Metadata={metadataBase:new URL(siteUrl),title:{default:'Nisvartha Foundation',template:'%s | Nisvartha Foundation'},description:'Nisvartha Foundation: community initiatives, projects and ways to get involved.',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){
 return <html lang="en"><body>
  <a className="skip-link" href="#main-content">Skip to content</a><SiteHeader/>{children}
  <footer className="footer"><div><Link href="/" className="footer-brand">Nisvartha Foundation</Link><p>Official content is being verified before public publication.</p></div>
   <nav aria-label="Footer"><Link href="/about">About</Link><Link href="/projects">Projects</Link><Link href="/contact">Contact</Link><Link href="/privacy-policy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/accessibility">Accessibility</Link></nav>
  </footer></body></html>;
}
