import type {Metadata} from 'next';
import {notFound,redirect} from 'next/navigation';
import {memberFetch,memberUiEnabled} from '@/lib/member-session';
import {MemberDashboard} from '@/components/member-dashboard';
import type {Member} from '@/components/member-dashboard';
import type {GenealogyView} from '@/components/genealogy-tree';
import type {UatScenario} from '@/components/uat-scenario-view';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Member application portal',robots:{index:false,follow:false,noarchive:true}};
export default async function MemberPage(){
 if(!memberUiEnabled())notFound();
 const response=await memberFetch('me');
 if(response.status===401)redirect('/member/login');
 if(!response.ok)throw Error('Unable to load member account');
 const member=await response.json() as Member;
 const treeResponse=member.status==='ACTIVE'&&
  (process.env.NISVARTHA_UAT_PIN_REGISTRATION==='synthetic'||
   process.env.REGISTRATION_ACCESS_PIN_ENABLED==='true')?
   await memberFetch('genealogy'):null;
 if(treeResponse&&!treeResponse.ok)throw Error('Unable to load invitation genealogy');
 const genealogy:GenealogyView|null=treeResponse?
  await treeResponse.json() as GenealogyView:null;
 const scenarioResponse=member.status==='ACTIVE'&&process.env.NISVARTHA_UAT_FINANCE==='synthetic'?
  await memberFetch('uat-scenario'):null;
 if(scenarioResponse&&!scenarioResponse.ok)throw Error('Unable to load local synthetic reference history');
 const scenario:UatScenario|null=scenarioResponse?await scenarioResponse.json() as UatScenario:null;
 return <main id="main-content" className="admin-shell foundation-admin foundation-member">
  <MemberDashboard initial={member} genealogy={genealogy} scenario={scenario}/>
 </main>;
}
