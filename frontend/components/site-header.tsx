'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useState} from 'react';

// Same branding, navigation labels and layout as the approved v1.1 client
// HTML header. The internal links use the existing Next.js routes.
const links=[
 ['/', 'Home'],
 ['/about','About Us'],
 ['/activities','Activities'],
 ['/go-green','Go Green'],
 ['/projects','Projects'],
 ['/volunteer','Volunteer'],
 ['/donate','Donate'],
 ['/membership','Membership'],
 ['/auto-pool-plan','Auto Pool Plan'],
 ['/gallery','Gallery'],
 ['/news-events','News & Events'],
 ['/contact','Contact'],
] as const;
export function SiteHeader({memberPortalEnabled,memberRegistrationEnabled}:{memberPortalEnabled:boolean;memberRegistrationEnabled:boolean}){
 const [open,setOpen]=useState(false);
 const navLinks=[...links,
  ...(memberPortalEnabled?[['/member/login','Login'] as const]:[]),
  ...(memberRegistrationEnabled?[['/member/register','Register'] as const]:[])
 ];
 const pathname=usePathname();
 return <>
  <div className="topbar client-topbar">
   <div className="container">
    <span>Together for a Brighter Tomorrow</span>
    <span>Contact: <a href="tel:+916360719137">+91 63607 19137</a></span>
   </div>
  </div>
  <header className="header site-header">
   <div className="container navwrap">
    <Link className="brand" href="/" aria-label="Nisvartha Foundation home"
     onClick={()=>setOpen(false)}>
     <span className="logo" aria-hidden="true">✦</span>
     <span>NISVARTHA<small>FOUNDATION</small></span>
    </Link>
    <button className="menu-button menu-btn" type="button"
     aria-expanded={open} aria-controls="main-nav"
     onClick={()=>setOpen(!open)}>Menu ☰</button>
    <nav className={'nav'+(open?' open':'')} id="main-nav" aria-label="Primary navigation">
     {navLinks.map(([href,label])=><Link key={href} href={href}
      aria-current={pathname===href?'page':undefined}
      className={
       (pathname===href?'active ':'')+
       (href==='/member/login'?'nav-cta':href==='/member/register'?'nav-cta register':'')
      }
      onClick={()=>setOpen(false)}>{label}</Link>)}
    </nav>
   </div>
  </header>
 </>;
}
