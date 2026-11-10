'use client';
import {FormEvent,useState} from 'react';
import {useRouter} from 'next/navigation';
import {AdminLogoutButton} from '@/components/admin-logout';
export function AdminPasswordForm(){
 const router=useRouter();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;
  const form=new FormData(e.currentTarget);
  const currentPassword=String(form.get('currentPassword')??'');
  const newPassword=String(form.get('newPassword')??'');
  if(newPassword!==String(form.get('confirmPassword')??'')){
   setError('New passwords do not match');return;
  }
  if(newPassword===currentPassword){setError('Choose a new password');return;}
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/admin/session/password',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({currentPassword,newPassword}),cache:'no-store'
   });
   if(!response.ok)throw Error(response.status===401?
    'Current password is incorrect or your session expired':
    'Unable to update administrator password');
   router.replace('/admin/login');router.refresh();
  }catch(err){setError(err instanceof Error?err.message:'Password change failed')}
  finally{setBusy(false)}
 }
 return <>
  <form className="admin-form" onSubmit={e=>void submit(e)}>
   <label>Temporary password
    <input type="password" name="currentPassword" autoComplete="current-password" required/>
   </label>
   <label>New private password (14–128 characters)
    <input type="password" name="newPassword" autoComplete="new-password" minLength={14} maxLength={128} required/>
   </label>
   <label>Confirm new password
    <input type="password" name="confirmPassword" autoComplete="new-password" minLength={14} maxLength={128} required/>
   </label>
   {error&&<p className="admin-error" role="alert">{error}</p>}
   <button className="button" type="submit" disabled={busy}>{busy?'Changing password…':'Change password and sign in again'}</button>
  </form>
  <p><AdminLogoutButton/></p>
 </>;
}
