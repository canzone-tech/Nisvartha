'use client';
import Link from 'next/link';
import {useState} from 'react';
export function SiteHeader(){const [open,setOpen]=useState(false);return <header><Link href="/">Nisvartha Foundation</Link><button type="button" onClick={()=>setOpen(!open)} aria-expanded={open}>Menu</button><nav hidden={!open}><Link href="/about">About</Link><Link href="/contact">Contact</Link></nav></header>}
