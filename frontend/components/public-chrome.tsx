'use client';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';

/**
 * Root public HTML/CSS is client-supplied and must not leak into the
 * application administration shell. Keep public markup/content unchanged.
 */
export function PublicChrome({children}:{children:ReactNode}){
 const pathname=usePathname();
 if(pathname==='/admin'||pathname.startsWith('/admin/'))return null;
 return <>{children}</>;
}
