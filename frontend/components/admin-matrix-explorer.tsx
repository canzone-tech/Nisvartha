'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {AdminMemberMatrix} from './admin-member-matrix';

type MemberRow={
 id:string;status:string;
 member:{id:string;displayName:string;email:string;status:string}
};
type MemberPage={items:MemberRow[];nextCursor:string|null};

// Read-only explorer: reuse the authorized member review pagination API and
// the existing per-member matrix API. No new placement or accounting logic.
export function AdminMatrixExplorer(){
 const [rows,setRows]=useState<MemberRow[]>([]);
 const [cursor,setCursor]=useState<string|null>(null);
 const [selected,setSelected]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const serial=useRef(0);

 const load=useCallback(async(next:string|null,append:boolean)=>{
  const request=++serial.current;
  setLoading(true);setError('');
  const query=new URLSearchParams({status:'APPROVED',limit:'25'});
  if(next)query.set('cursor',next);
  try{
   const response=await fetch(
    '/api/admin/backend/cms/membership/applications/page?'+query.toString(),
    {cache:'no-store'}
   );
   if(!response.ok)throw Error('Unable to load active member records');
   const data=await response.json() as MemberPage;
   if(!Array.isArray(data.items)||data.items.length>25||
      (data.nextCursor!==null&&typeof data.nextCursor!=='string')||
      data.items.some(item=>item.status!=='APPROVED'||
       typeof item.member?.id!=='string'||
       typeof item.member?.displayName!=='string'))
    throw Error('Unexpected member list response');
   if(request!==serial.current)return;
   setRows(previous=>append?[...previous,...data.items]:data.items);
   setCursor(data.nextCursor);
  }catch(cause){
   if(request!==serial.current)return;
   setError(cause instanceof Error?cause.message:'Unable to load members');
  }finally{if(request===serial.current)setLoading(false)}
 },[]);
 useEffect(()=>{void Promise.resolve().then(()=>load(null,false))},[load]);

 return <section className="admin-panel" aria-label="Active member matrix explorer">
  <h2>1:3 member matrix</h2>
  <p>Choose an active member to inspect their actual assigned positions and rebirth history.
   Direct invitations are separate from matrix parent placement.</p>
  {error&&<p className="admin-error" role="alert">{error}</p>}
  {loading&&<p role="status">Loading members…</p>}
  {!loading&&rows.length===0&&!error&&<p>No active members to show.</p>}
  <div className="cms-list">
   {rows.filter(row=>row.member.status==='ACTIVE').map(row=>
    <article key={row.member.id} className="cms-row">
     <div><strong>{row.member.displayName}</strong><p>{row.member.email}</p></div>
     <div className="cms-row-actions">
      <button type="button" aria-expanded={selected===row.member.id}
       onClick={()=>setSelected(previous=>previous===row.member.id?null:row.member.id)}>
       {selected===row.member.id?'Hide matrix':'View matrix'}
      </button>
     </div>
     {selected===row.member.id&&<AdminMemberMatrix memberId={row.member.id}/>}
    </article>
   )}
  </div>
  {cursor&&<button type="button" className="button" disabled={loading}
   onClick={()=>void load(cursor,true)}>Load more members</button>}
 </section>;
}
