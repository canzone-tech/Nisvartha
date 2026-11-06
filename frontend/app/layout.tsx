import './globals.css';
import type {Metadata} from 'next';
import {SiteChrome} from '@/components/site-chrome';
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
  <style id="approved-client-styles" dangerouslySetInnerHTML={{__html:clientStyles()}}/>
  <a className="skip-link" href="#main-content">Skip to main content</a>
  <SiteChrome>{children}</SiteChrome>
 </body></html>;
}
