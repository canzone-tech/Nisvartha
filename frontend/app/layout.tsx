import './globals.css';
import {SiteHeader} from '@/components/site-header';
export const metadata={robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><SiteHeader/>{children}</body></html>}
