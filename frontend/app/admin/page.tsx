import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {AdminWorkspace,legacyAdminHref} from '@/components/admin-workspace';

export const metadata:Metadata={title:'Foundation dashboard',robots:{index:false,follow:false}};
// Preserve old bookmarks; destination page rechecks backend staff role.
export default async function AdminPage({searchParams}:{
 searchParams:Promise<{view?:string|string[]}>
}){
 const requested=(await searchParams).view;
 if(typeof requested==='string'){
  const destination=legacyAdminHref(requested);
  if(destination)redirect(destination);
 }
 return <AdminWorkspace view="overview"/>;
}
