import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {ClientPage} from '@/components/client-page';

/**
 * The client page is a review notice, not a financial plan enrollment page.
 * Show it only in an isolated disposable UAT on localhost, never publicly.
 */
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Auto Pool Plan — Review Pending',robots:{index:false,follow:false}};
function localReviewOnly(){
 if(process.env.NISVARTHA_UAT_PLAN!=='synthetic'||
    process.env.PUBLIC_CONTENT_APPROVED!=='false')return false;
 try{
  const site=new URL(process.env.NEXT_PUBLIC_SITE_URL||'');
  const db=new URL(process.env.DATABASE_URL||'');
  return site.protocol==='http:'&&['127.0.0.1','localhost'].includes(site.hostname)&&
   db.protocol==='mysql:'&&['127.0.0.1','localhost'].includes(db.hostname)&&
   db.pathname==='/nisvartha_ci';
 }catch{return false}
}
export default function PlanReview(){
 if(!localReviewOnly())notFound();
 return <ClientPage slug="auto-pool-plan"/>;
}
