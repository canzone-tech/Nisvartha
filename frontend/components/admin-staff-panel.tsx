'use client';
import {FormEvent,useEffect,useState} from 'react';
type Account={id:string;email:string;displayName:string;role:string;status:string};
const roles=['ADMIN','EDITOR','APPROVER','AUDITOR'] as const;
export function StaffManagement(){
 const [rows,setRows]=useState<Account[]>([]);
 const [email,setEmail]=useState(''),[displayName,setDisplayName]=useState(''),[password,setPassword]=useState(''),[role,setRole]=useState<typeof roles[number]>('EDITOR');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function load(){
  const response=await fetch('/api/admin/backend/staff/accounts',{cache:'no-store'});
  if(!response.ok)throw new Error('Unable to list staff accounts');
  setRows(await response.json() as Account[]);
 }
 useEffect(()=>{void Promise.resolve().then(load).catch(e=>setError(e instanceof Error?e.message:'Failed to load staff'))},[]);
 async function mutation(path:string,method:'POST'|'PATCH',payload:object){
  setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/admin/backend/'+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const data=await response.json().catch(()=>null);
   if(!response.ok)throw new Error(data?.message||'Staff operation failed');
   setMessage('Staff permission change recorded and audited');
   await load();return true;
  }catch(e){setError(e instanceof Error?e.message:'Action failed');return false}
  finally{setBusy(false)}
 }
 async function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(await mutation('staff/accounts','POST',{email,displayName,password,role})){setEmail('');setDisplayName('');setPassword('');}
 }
 return <section className="admin-panel"><h2>Staff accounts & permissions</h2>
  <p>Only approved administrators can create or change staff identities. Role and status changes revoke existing sessions.</p>
  {message&&<p role="status" className="admin-success">{message}</p>}
  {error&&<p role="alert" className="admin-error">{error}</p>}
  <form className="admin-form" onSubmit={create}>
   <label>Staff name <input value={displayName} onChange={e=>setDisplayName(e.target.value)} minLength={2} maxLength={120} required/></label>
   <label>Staff email <input type="email" autoComplete="off" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
   <label>Initial password (14 characters minimum) <input type="password" autoComplete="new-password" minLength={14} value={password} onChange={e=>setPassword(e.target.value)} required/></label>
   <label>Role <select value={role} onChange={e=>setRole(e.target.value as typeof roles[number])}>{roles.map(v=><option value={v} key={v}>{v}</option>)}</select></label>
   <button className="button" type="submit" disabled={busy}>Create staff account</button>
  </form>
  <div className="cms-list">{rows.map(row=><article className="cms-row" key={row.id}>
   <div><strong>{row.displayName}</strong><p>{row.email}</p><p>{row.role} · {row.status}</p></div>
   {row.role==='SUPER_ADMIN'?<p>Protected role — changes require a separately approved trusted-host procedure.</p>:<div className="cms-row-actions">
    {roles.filter(r=>r!==row.role).map(r=><button disabled={busy} key={r} type="button" onClick={()=>void mutation('staff/accounts/'+row.id,'PATCH',{role:r,status:row.status})}>Make {r}</button>)}
    <button disabled={busy} type="button" onClick={()=>void mutation('staff/accounts/'+row.id,'PATCH',{role:row.role,status:row.status==='ACTIVE'?'DISABLED':'ACTIVE'})}>{row.status==='ACTIVE'?'Deactivate':'Reactivate'}</button>
   </div>}
  </article>)}</div>
 </section>;
}
