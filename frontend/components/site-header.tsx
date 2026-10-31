'use client';
import Link from 'next/link';
import {useState} from 'react';
export function SiteHeader(){const [open,setOpen]=useState(false);return <header><Link href="/">Nisvartha Foundation</Link><button type="button" onClick={()=>setOpen(!open)} aria-expanded={open} aria-controls="main-nav">Menu</button><nav id="main-nav" className={open?'open':''}><Link href="/about">About</Link><Link href="/projects">Projects</Link><Link href="/volunteer">Volunteer</Link><Link href="/contact">Contact</Link></nav></header>}
