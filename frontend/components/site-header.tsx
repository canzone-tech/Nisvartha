'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useState} from 'react';
import {navLinks} from '@/lib/site';
export function SiteHeader(){
 const [open,setOpen]=useState(false);const path=usePathname();
 return <header className="site-header">
  <Link className="brand" href="/" aria-label="Nisvartha Foundation home" onClick={()=>setOpen(false)}>
   <span className="brand-mark" aria-hidden="true">N</span><span>Nisvartha <strong>Foundation</strong></span>
  </Link>
  <button className="menu-button" type="button" aria-controls="main-nav" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'Close menu':'Menu'}</button>
  <nav id="main-nav" aria-label="Primary" className={open?'open':''}>
   {navLinks.map(([href,label])=><Link href={href} key={href} aria-current={path===href?'page':undefined} onClick={()=>setOpen(false)}>{label}</Link>)}
  </nav>
 </header>;
}
