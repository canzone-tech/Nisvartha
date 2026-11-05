'use client';
import {useCallback,useEffect,useRef,useState} from 'react';

export type SandboxConfig={entrants:number;rebirthAtLevel4:number;
 rebirthAtLevel5:number;rebirthLimit:number;rebirthEnabled:boolean};
type SavedScenario=SandboxConfig&{
 id:number;requestKey:string;authorId:string;reviewerId:string|null;
 status:'DRAFT'|'SUBMITTED'|'REVIEWED'|'REJECTED';reason:string|null;
 createdAt:string;submittedAt:string|null;reviewedAt:string|null;
};
const keys=['entrants','rebirthAtLevel4','rebirthAtLevel5','rebirthLimit','rebirthEnabled'] as const;
function describeDiff(item:SavedScenario,prior:SavedScenario|undefined){
 if(!prior)return 'First retained scenario version';
 const changes=keys.filter(key=>item[key]!==prior[key])
  .map(key=>key+': '+String(prior[key])+' → '+String(item[key]));
 return changes.length?changes.join('; '):'Same settings as previous retained version';
}
async function fetchSavedVersions():Promise<SavedScenario[]>{
 const r=await fetch('/api/admin/backend/staff/matrix-preview/policies',{cache:'no-store'});
 if(!r.ok)throw Error('Scenario history is unavailable');
 const data:unknown=await r.json();
 if(!Array.isArray(data)||data.length>50||
  !data.every(x=>x&&typeof x==='object'&&typeof x.id==='number'&&
    typeof x.status==='string'&&typeof x.authorId==='string'))
  throw Error('Unexpected scenario history response');
 return data as SavedScenario[];
}
export function AdminSandboxPolicyRevisions({
 config,canEdit,actorId
}:{config:SandboxConfig|null;canEdit:boolean;actorId:string}){
 const [rows,setRows]=useState<SavedScenario[]>([]);
 const [error,setError]=useState('');
 const [status,setStatus]=useState('');
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [reason,setReason]=useState('');
 const attempted=useRef<{body:string;requestKey:string}|null>(null);
 const refresh=useCallback(async()=>{
  try{setRows(await fetchSavedVersions());setError('')}
  catch(e){setError(e instanceof Error?e.message:'Cannot load versions')}
  finally{setLoading(false)}
 },[]);
 useEffect(()=>{
  let active=true;
  void fetchSavedVersions().then(data=>{if(active){setRows(data);setError('')}})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:'Cannot load versions')})
   .finally(()=>{if(active)setLoading(false)});
  return ()=>{active=false};
 },[]);

 const post=async(path:string,body?:unknown)=>{
  const response=await fetch('/api/admin/backend/staff/matrix-preview/'+path,{
   method:'POST',cache:'no-store',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify(body||{})
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw Error(
   typeof data?.message==='string'?data.message:
   Array.isArray(data?.message)?data.message.join(', '):'Scenario action rejected');
  return data;
 };
 async function save(){
  if(!canEdit||!config)return;
  setBusy(true);setError('');setStatus('');
  try{
   const body=JSON.stringify(config);
   if(!attempted.current||attempted.current.body!==body)
    attempted.current={body,requestKey:crypto.randomUUID()};
   const saved=await post('policies',{...config,requestKey:attempted.current.requestKey});
   setStatus('Scenario version #'+saved.id+' saved as a draft. Not active.');
   attempted.current=null;await refresh();
  }catch(e){setError(e instanceof Error?e.message:'Save failed')}
  finally{setBusy(false)}
 }
 async function submit(id:number){
  setBusy(true);setError('');setStatus('');
  try{await post('policies/'+id+'/submit');
   setStatus('Version #'+id+' submitted for independent scenario review.');await refresh();
  }catch(e){setError(e instanceof Error?e.message:'Submit failed')}
  finally{setBusy(false)}
 }
 async function review(id:number,decision:'REVIEWED'|'REJECTED'){
  setBusy(true);setError('');setStatus('');
  try{
   await post('policies/'+id+'/review',{decision,reason});
   setStatus('Version #'+id+' '+decision.toLowerCase()+' — no policy activated.');
   setReason('');await refresh();
  }catch(e){setError(e instanceof Error?e.message:'Review failed')}
  finally{setBusy(false)}
 }
 return <section className="admin-panel">
  <h2>Saved scenario versions and independent review</h2>
  <p>MySQL retains the immutable simulation settings and a separate review decision.
   <strong> Reviewed does not mean active.</strong> No member placement,
   financial entitlement or rebirth ID is issued.</p>
  {canEdit&&<button className="button" type="button" disabled={busy||!config}
   onClick={()=>void save()}>Save new draft version</button>}
  <button type="button" disabled={busy||loading} onClick={()=>void refresh()}>
   Refresh scenario history</button>
  {status&&<p role="status">{status}</p>}
  {error&&<p role="alert" className="admin-error">{error}</p>}
  {loading&&<p role="status">Loading retained versions…</p>}
  {!loading&&rows.length===0&&<p>No saved sandbox versions yet.</p>}
  <div className="cms-list">{rows.map((item,i)=><article className="cms-row" key={item.id}>
   <div>
    <h3>Version #{item.id} · {item.status}</h3>
    <p>Registrations: {item.entrants} · Rebirth (L4/L5):
     {item.rebirthAtLevel4}/{item.rebirthAtLevel5} ·
     Cap {item.rebirthLimit} · Enabled {item.rebirthEnabled?'Yes':'No'}</p>
    <p>{describeDiff(item,rows[i+1])}</p>
    <p><small>Created {new Date(item.createdAt).toLocaleString()}</small></p>
    {item.reason&&<p>Review note: {item.reason}</p>}
    {canEdit&&item.status==='DRAFT'&&item.authorId===actorId&&
     <button type="button" disabled={busy} onClick={()=>void submit(item.id)}>
      Submit version for independent review</button>}
    {!canEdit&&item.status==='SUBMITTED'&&item.authorId!==actorId&&
     <div className="admin-form">
      <label>Independent reviewer reason (8–300 characters)
       <textarea minLength={8} maxLength={300} rows={2}
        value={reason} onChange={e=>setReason(e.target.value)}/></label>
      <div className="row">
       <button type="button" disabled={busy||reason.trim().length<8}
        onClick={()=>void review(item.id,'REVIEWED')}>Mark reviewed (simulation only)</button>
       <button type="button" disabled={busy||reason.trim().length<8}
        onClick={()=>void review(item.id,'REJECTED')}>Reject scenario</button>
      </div>
     </div>}
   </div>
  </article>)}</div>
  {rows.length===50&&<p>Showing latest 50 retained versions.</p>}
 </section>;
}
