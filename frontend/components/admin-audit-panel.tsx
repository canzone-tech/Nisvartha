'use client';
import {useEffect,useState} from 'react';
type Event={id:string;actorId:string;action:string;objectType:string;objectId:string;summary:string;createdAt:string};
export function AdminAuditPanel(){
 const [rows,setRows]=useState<Event[]>([]),[error,setError]=useState('');
 useEffect(()=>{void Promise.resolve().then(async()=>{
  const response=await fetch('/api/admin/backend/cms/audit',{cache:'no-store'});
  if(!response.ok)throw Error('Audit access denied');
  setRows(await response.json() as Event[]);
 }).catch(e=>setError(e instanceof Error?e.message:'Audit unavailable'))},[]);
 return <section className="admin-panel"><h2>Recent administrative audit</h2>
  <p>Read-only record of actor, operation, object and time. Restricted to administrators and auditors.</p>
  {error&&<p role="alert">{error}</p>}
  {rows.length===0?<p>No audit events to display.</p>:<div className="cms-list">{rows.map(row=><article className="cms-row" key={row.id}>
   <div><strong>{row.action}</strong><p>{row.summary}</p><p>{row.objectType} · {row.objectId}</p></div>
   <div><time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString()}</time><p>Actor: {row.actorId}</p></div>
  </article>)}</div>}
 </section>;
}
