import type {Metadata} from 'next';
import {notFound,redirect} from 'next/navigation';
import {memberFetch,memberUiEnabled} from '@/lib/member-session';
import {MemberDashboard} from '@/components/member-dashboard';
import type {Member} from '@/components/member-dashboard';
import type {GenealogyView} from '@/components/genealogy-tree';
import type {MemberMatrixView} from '@/components/member-matrix-tree';
import type {MemberEarningsView} from '@/components/member-earnings';
import type {MemberWalletView} from '@/components/member-wallet';
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
 const matrixResponse=member.status==='ACTIVE'&&process.env.MATRIX_PLACEMENT_ENABLED==='true'?
  await memberFetch('matrix'):null;
 if(matrixResponse&&!matrixResponse.ok)throw Error('Unable to load member matrix');
 const matrix:MemberMatrixView|null=matrixResponse?await matrixResponse.json() as MemberMatrixView:null;
 const earningsResponse=member.status==='ACTIVE'&&process.env.MEMBER_COMPENSATION_ENABLED==='true'?
  await memberFetch('earnings'):null;
 if(earningsResponse&&!earningsResponse.ok)throw Error('Unable to load member earnings');
 const earnings:MemberEarningsView|null=earningsResponse?await earningsResponse.json() as MemberEarningsView:null;
 const walletResponse=process.env.MEMBER_WALLET_ENABLED==='true'?await memberFetch('wallet'):null;
 if(walletResponse&&!walletResponse.ok)throw Error('Unable to load member wallet');
 const wallet:MemberWalletView|null=walletResponse?await walletResponse.json() as MemberWalletView:null;
 return <main id="main-content" className="admin-shell foundation-admin foundation-member">
  <MemberDashboard initial={member} genealogy={genealogy} matrix={matrix} earnings={earnings} wallet={wallet}
   autoActivate={process.env.MEMBER_PIN_AUTO_ACTIVATE_ENABLED==='true'}/>
 </main>;
}
