'use client';
import {useRouter} from 'next/navigation';
export function AdminLogoutButton(){
 const router=useRouter();
 return <button className="button alt" type="button" onClick={async()=>{
  await fetch('/api/admin/session/logout',{method:'POST'});
  router.replace('/admin/login');router.refresh();
 }}>Sign out</button>;
}
