'use client';
import {FormEvent,useEffect,useState} from 'react';

type Policy={entrants:number;rebirthAtLevel4:number;rebirthAtLevel5:number;
 rebirthLimit:number;rebirthEnabled:boolean};
type Level={level:number;capacity:number;filled:number;complete:boolean};
type Preview={status:'SIMULATION_ONLY';placed:number;capacity:number;unfilled:number;
 canCredit:false;canIssueRebirth:false;canAcceptPayment:false;
 levels:Level[];
 rebirthCandidates:{level:number;count:number;threshold:number;status:'NOT_ISSUED'}[];
 positions:{id:string;parentId:string|null;slot:number;level:number}[];
 displayTruncated:boolean;ruleAssumption:string};
type Defaults={config:Policy;reference:{
 joiningAmountINR:number;directReferralINR:number;levelPayoutsINR:readonly number[];
 };persisted:false};

export function AdminMatrixPreview(){
 const [config,setConfig]=useState<Policy|null>(null),[source,setSource]=useState<Defaults|null>(null);
 const [result,setResult]=useState<Preview|null>(null);
 const [error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 useEffect(()=>{
  let live=true;
  fetch('/api/admin/backend/staff/matrix-preview/defaults',{cache:'no-store'})
   .then(async res=>{
    if(!res.ok)throw Error('Sandbox matrix policy not available');
    return await res.json() as Defaults;
   }).then(data=>{if(live){setSource(data);setConfig(data.config)}})
   .catch(e=>{if(live)setError(e instanceof Error?e.message:'Policy unavailable')})
   .finally(()=>{if(live)setLoading(false)});
  return ()=>{live=false};
 },[]);
 function number(key:'entrants'|'rebirthAtLevel4'|'rebirthAtLevel5'|'rebirthLimit',value:string){
  setConfig(prev=>prev?{...prev,[key]:value===''?NaN:Number(value)}:null);
  setResult(null);
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!config)return;
  setBusy(true);setError('');setResult(null);
  try{
   const res=await fetch('/api/admin/backend/staff/matrix-preview/simulate',{
    method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(config)
   });
   const value=await res.json();
   if(!res.ok)throw Error(typeof value?.message==='string'?value.message:'Invalid configuration');
   if(value.status!=='SIMULATION_ONLY'||value.canCredit!==false||
    value.canIssueRebirth!==false||value.canAcceptPayment!==false)
    throw Error('Unsafe simulation response');
   setResult(value as Preview);
  }catch(e){setError(e instanceof Error?e.message:'Simulation failed')}
  finally{setBusy(false)}
 }
 return <section className="admin-panel">
  <h2>1:3 matrix and rebirth configuration — sandbox</h2>
  <p>This is a deterministic, non-operational modelling tool. It does not create placement
   records, rebirth IDs, wallet balances, commissions or payment entitlements.</p>
  <p><strong>Rule assumption:</strong> Rebirth candidates are shown only when all positions
   through level 4 or level 5 have been filled. The client has not specified the legally
   approved rebirth placement, repeat cycles or commission funding rules.</p>
  {loading&&<p role="status">Loading reference configuration…</p>}
  {error&&<p role="alert" className="admin-error">{error}</p>}
  {config&&<form className="admin-form" onSubmit={submit}>
   <label>Simulated registrations (0–363)
    <input type="number" value={config.entrants} min={0} max={363} required
     onChange={e=>number('entrants',e.target.value)}/></label>
   <p>Branching width: <strong>3 fixed</strong> · Depth: <strong>5 levels</strong> ·
    Simulated placement order: <strong>breadth-first</strong></p>
   <label className="media-consent">
    <input type="checkbox" checked={config.rebirthEnabled}
     onChange={e=>{setConfig(prev=>prev?{...prev,rebirthEnabled:e.target.checked}:null);setResult(null)}}/>
    Show rebirth candidates in the preview
   </label>
   <label>Rebirth candidates on level 4 completion
    <input type="number" min={0} max={16} required value={config.rebirthAtLevel4}
     onChange={e=>number('rebirthAtLevel4',e.target.value)}/></label>
   <label>Rebirth candidates on level 5 completion
    <input type="number" min={0} max={16} required value={config.rebirthAtLevel5}
     onChange={e=>number('rebirthAtLevel5',e.target.value)}/></label>
   <label>Maximum rebirth candidates per preview
    <input type="number" min={0} max={16} required value={config.rebirthLimit}
     onChange={e=>number('rebirthLimit',e.target.value)}/></label>
   <p>These settings are a draft in this browser session, <strong>not a persisted
    or published policy</strong>. Changing values does not affect a real member.</p>
   <button className="button" disabled={busy} type="submit">
    {busy?'Simulating…':'Preview matrix and rebirth'}</button>
  </form>}
  {source&&<div className="admin-policy">
   <h3>Owner-supplied flyer reference (unverified)</h3>
   <p>Joining reference: ₹{source.reference.joiningAmountINR.toLocaleString('en-IN')} ·
    Direct-referral reference: ₹{source.reference.directReferralINR.toLocaleString('en-IN')}</p>
   <p>Level payout figures from the flyer: {source.reference.levelPayoutsINR
    .map(v=>'₹'+v.toLocaleString('en-IN')).join(' / ')}.</p>
   <p>These amounts are displayed only as source inputs. <strong>No amount is
    calculated, earned, credited or payable</strong> through this simulator.</p>
  </div>}
  {result&&<div className="admin-policy" role="status">
   <h3>Simulated placement</h3>
   <p>{result.placed} / {result.capacity} positions filled ·
    {result.unfilled} available in the reference five-level tree.</p>
   <div className="table-scroll"><table>
    <thead><tr><th>Level</th><th>Capacity</th><th>Simulated placed</th><th>Completed</th></tr></thead>
    <tbody>{result.levels.map(level=><tr key={level.level}>
     <td>{level.level}</td><td>{level.capacity}</td><td>{level.filled}</td>
     <td>{level.complete?'Yes':'No'}</td>
    </tr>)}</tbody>
   </table></div>
   <h3>Configured rebirth candidates (not issued)</h3>
   {result.rebirthCandidates.length===0?<p>No level-completion candidates yet.</p>:
    <ul>{result.rebirthCandidates.map(item=><li key={item.level}>
     Level {item.level}: {item.count} proposed re-entry IDs at {item.threshold}
     filled positions — <strong>NOT ISSUED</strong>
    </li>)}</ul>}
   <details><summary>Inspect first simulated placements</summary>
    <div className="table-scroll"><table>
     <thead><tr><th>Simulated ID</th><th>Parent</th><th>Level</th><th>Slot</th></tr></thead>
     <tbody>{result.positions.slice(1).map(p=><tr key={p.id}>
      <td>{p.id}</td><td>{p.parentId}</td><td>{p.level}</td><td>{p.slot}</td>
     </tr>)}</tbody></table></div>
    {result.displayTruncated&&<p>Placement preview limited to 150 positions; level counts remain complete.</p>}
   </details>
  </div>}
 </section>;
}
