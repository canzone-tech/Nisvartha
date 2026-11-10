'use client';
import {useEffect,useState} from 'react';
type Account={id:string;email:string;displayName:string;role:string;status:'ACTIVE'|'DISABLED'};
export function StaffManagement({currentAdminId}:{currentAdminId:string}){
 const [rows,setRows]=useState<Account[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function load(){
  const response=await fetch('/api/admin/backend/staff/accounts',{cache:'no-store'});
  if(!response.ok)throw Error('Unable to load administrator inventory');
  setRows(await response.json() as Account[]);
 }
 useEffect(()=>{void Promise.resolve().then(load).catch(e=>setError(e instanceof Error?e.message:'Administrator inventory unavailable'))},[]);
 async function retire(id:string){
  if(id===currentAdminId)return;
  if(!window.confirm('Disable this legacy administrator and revoke its active sessions? This operation cannot be reversed in the application.'))return;
  setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/admin/backend/staff/accounts/'+id,{
    method:'PATCH',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({status:'DISABLED'})
   });
   const body=await response.json().catch(()=>null);
   if(!response.ok)throw Error(body?.message||'Administrator retirement failed');
   setMessage('Legacy administrator disabled. Active sessions revoked and operation audited.');
   await load();
  }catch(err){setError(err instanceof Error?err.message:'Retirement failed')}
  finally{setBusy(false)}
 }
 const active=rows.filter(row=>row.status==='ACTIVE');
 return <section className="admin-panel"><h2>Administrator security</h2>
  <p>NISVARTHA has one operational ADMIN. New administrator accounts cannot be created through the website or API. The current administrator manages members, registration access and approved operations.</p>
  {active.length>1&&<p role="alert" className="admin-error">Legacy data contains {active.length} active administrators. Disable extras before production acceptance; no account is removed automatically.</p>}
  {message&&<p role="status" className="admin-success">{message}</p>}
  {error&&<p role="alert" className="admin-error">{error}</p>}
  <div className="cms-list">{rows.map(account=><article className="cms-row" key={account.id}>
   <div><strong>{account.displayName}{account.id===currentAdminId?' (current administrator)':''}</strong>
    <p>{account.email}</p><p>{account.role} · {account.status}</p></div>
   {account.id!==currentAdminId&&account.status==='ACTIVE'&&
    <div className="cms-row-actions">
     <button type="button" disabled={busy} onClick={()=>void retire(account.id)}>Disable legacy administrator</button>
    </div>}
  </article>)}</div>
 </section>;
}
