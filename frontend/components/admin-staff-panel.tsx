'use client';
import {FormEvent,useEffect,useState} from 'react';
type Account={id:string;email:string;displayName:string;role:string;status:string};
export function StaffManagement(){
 const [rows,setRows]=useState<Account[]>([]);
 const [email,setEmail]=useState(''),[displayName,setDisplayName]=useState(''),[password,setPassword]=useState('');
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
  if(await mutation('staff/accounts','POST',{email,displayName,password})){setEmail('');setDisplayName('');setPassword('');}
 }
 return <section className="admin-panel"><h2>Administrator accounts</h2>
  <p>Administrator accounts have one role: ADMIN. Status changes revoke existing sessions and are audited.</p>
  {message&&<p role="status" className="admin-success">{message}</p>}
  {error&&<p role="alert" className="admin-error">{error}</p>}
  <form className="admin-form" onSubmit={create}>
   <label>Staff name <input value={displayName} onChange={e=>setDisplayName(e.target.value)} minLength={2} maxLength={120} required/></label>
   <label>Staff email <input type="email" autoComplete="off" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
   <label>Initial password (14 characters minimum) <input type="password" autoComplete="new-password" minLength={14} value={password} onChange={e=>setPassword(e.target.value)} required/></label>
      <button className="button" type="submit" disabled={busy}>Create administrator</button>
  </form>
  <div className="cms-list">{rows.map(row=><article className="cms-row" key={row.id}>
   <div><strong>{row.displayName}</strong><p>{row.email}</p><p>{row.role} · {row.status}</p></div>
   <div className="cms-row-actions"><button disabled={busy} type="button" onClick={()=>void mutation('staff/accounts/'+row.id,'PATCH',{status:row.status==='ACTIVE'?'DISABLED':'ACTIVE'})}>{row.status==='ACTIVE'?'Deactivate':'Reactivate'}</button></div>
  </article>)}</div>
 </section>;
}
