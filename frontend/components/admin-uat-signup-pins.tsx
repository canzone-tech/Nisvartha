'use client';
import {FormEvent,useCallback,useEffect,useState} from 'react';
import {localExpiryToUtcIso} from '@/lib/epin-expiry';


type PinStatus='ALL'|'AVAILABLE'|'USED'|'EXPIRED';
type PinRecord={id:string;batchId:string;displaySuffix:string;expiresAt:string;
 createdAt:string;redeemedAt:string|null;redeemedByMemberId:string|null;
 batchQuantity:number;batchCreatedAt:string;status:Exclude<PinStatus,'ALL'>};
type PinInventory={classification:'SYNTHETIC_NONFINANCIAL_UAT_ONLY';total:number;
 counts:{available:number;used:number;expired:number};status:PinStatus;
 items:PinRecord[];nextCursor:string|null};
const filters:PinStatus[]=['ALL','AVAILABLE','USED','EXPIRED'];
function SyntheticPinInventory({refreshKey}:{refreshKey:number}){
 const [filter,setFilter]=useState<PinStatus>('ALL'),[items,setItems]=useState<PinRecord[]>([]);
 const [nextCursor,setNextCursor]=useState<string|null>(null);
 const [counts,setCounts]=useState<PinInventory['counts']|null>(null);
 const [total,setTotal]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=useCallback(async(cursor:string|null,append:boolean)=>{
  setBusy(true);setError('');
  try{
   const query=new URLSearchParams({status:filter});
   if(cursor)query.set('cursor',cursor);
   const response=await fetch('/api/admin/backend/cms/membership/uat-pins?'+query,{cache:'no-store'});
   const data:PinInventory=await response.json();
   if(!response.ok)throw Error('Unable to load E-PIN inventory');
   if(data.classification!=='SYNTHETIC_NONFINANCIAL_UAT_ONLY'||
      !Array.isArray(data.items)||data.items.length>50||
      !data.items.every(pin=>typeof pin.id==='string'&&
        typeof pin.displaySuffix==='string'&&/^(AVAILABLE|USED|EXPIRED)$/.test(pin.status)))
    throw Error('Unexpected E-PIN inventory response');
   setItems(previous=>append?[...previous,...data.items]:data.items);
   setNextCursor(data.nextCursor);
   setCounts(data.counts);setTotal(data.total);
  }catch(err){setError(err instanceof Error?err.message:'E-PIN inventory unavailable')}
  finally{setBusy(false)}
 },[filter]);
 useEffect(()=>{void load(null,false)},[load,refreshKey]);
 return <section className="admin-panel admin-pin-inventory">
  <div className="admin-heading"><div>
   <h2>Registration E-PIN inventory</h2>
   <p>Authoritative synthetic UAT records. Codes are masked; no purchase, wallet or payout information.</p>
  </div><button className="button alt" type="button" disabled={busy}
   onClick={()=>void load(null,false)}>Refresh list</button></div>
  {counts&&<div className="foundation-admin-stats" aria-label="E-PIN inventory totals">
   <div><strong>{total}</strong><span>All synthetic PINs</span></div>
   <div><strong>{counts.available}</strong><span>Available</span></div>
   <div><strong>{counts.used}</strong><span>Used</span></div>
   <div><strong>{counts.expired}</strong><span>Expired</span></div>
  </div>}
  <div className="admin-pin-filters" role="group" aria-label="Filter E-PIN status">
   {filters.map(item=><button type="button" key={item} disabled={busy}
    className={item===filter?'active':''} aria-pressed={item===filter}
    onClick={()=>setFilter(item)}>{item==='ALL'?'All':item[0]+item.slice(1).toLowerCase()}</button>)}
  </div>
  {error&&<p className="admin-error" role="alert">{error}</p>}
  {busy&&<p role="status">Loading inventory…</p>}
  {!busy&&!error&&items.length===0&&<p>No matching synthetic PINs.</p>}
  {items.length>0&&<div className="table-scroll"><table className="admin-pin-table">
   <thead><tr><th>PIN (masked)</th><th>Status</th><th>Batch</th><th>Created</th><th>Expiry</th><th>Member</th></tr></thead>
   <tbody>{items.map(pin=><tr key={pin.id}>
    <td><code>••••••{pin.displaySuffix}</code></td>
    <td><span className="admin-pin-status">{pin.status}</span></td>
    <td><code title={pin.batchId}>{pin.batchId.slice(0,8)}</code></td>
    <td>{new Date(pin.createdAt).toLocaleDateString()}</td>
    <td>{new Date(pin.expiresAt).toLocaleString()}</td>
    <td>{pin.redeemedByMemberId?<code title={pin.redeemedByMemberId}>{pin.redeemedByMemberId.slice(0,8)}</code>:'—'}</td>
   </tr>)}</tbody>
  </table></div>}
  {nextCursor&&<button className="button alt" type="button" disabled={busy}
   onClick={()=>void load(nextCursor,true)}>Load more PINs</button>}
  <p className="foundation-admin-footnote">Plaintext PINs are shown once at creation. This list never reveals PIN secrets or hashes.</p>
 </section>;
}

/** Demo-only credentials; never payment or real paid E-PIN issuance. */
export function AdminUatSignupPins(){
 const [quantity,setQuantity]=useState('3');
 const [expiresAt,setExpiresAt]=useState('');
 const [codes,setCodes]=useState<string[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [batch,setBatch]=useState('');
 const [refreshKey,setRefreshKey]=useState(0);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const expiry=localExpiryToUtcIso(expiresAt);
  if(!expiry){setError('Choose a valid date and time');return}
  setBusy(true);setError('');setCodes([]);setBatch('');
  try{
   const requestKey=crypto.randomUUID();
   const response=await fetch('/api/admin/backend/cms/membership/uat-pins',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({quantity:Number(quantity),expiresAt:expiry,requestKey})
   });
   const result=await response.json().catch(()=>null);
   if(!response.ok)throw Error(typeof result?.message==='string'?result.message:'Unable to create synthetic PINs');
   if(result?.classification!=='SYNTHETIC_NONFINANCIAL_UAT_ONLY'||
      !Array.isArray(result.codes)||result.codes.length!==Number(quantity))
     throw Error('Invalid synthetic PIN batch response');
   setCodes(result.codes);setBatch(result.batchId);setRefreshKey(x=>x+1);
  }catch(err){setError(err instanceof Error?err.message:'Synthetic PIN request failed')}
  finally{setBusy(false)}
 }
 return <><SyntheticPinInventory refreshKey={refreshKey}/><section className="admin-panel">
  <h2>Generate synthetic registration E-PINs (UAT only)</h2>
  <p>These nonfinancial codes work only in the disposable local MySQL UAT stack.
   They never collect fees, issue paid E-PINs, activate memberships or grant commissions.
   Codes appear exactly once; do not use real applicant data.</p>
  <form className="admin-form" onSubmit={submit}>
   <label>Quantity (1–50)<input type="number" min={1} max={50} step={1}
    value={quantity} onChange={e=>setQuantity(e.target.value)} required/></label>
   <label>Expiry date and time (device local time)
    <input type="datetime-local" step={60} value={expiresAt} onChange={e=>setExpiresAt(e.target.value)} required/>
   </label>
   {expiresAt&&<p>UTC expiry: {localExpiryToUtcIso(expiresAt)||'Invalid date or time'}</p>}
   <button className="button" disabled={busy}>{busy?'Generating…':'Generate synthetic E-PINs'}</button>
  </form>
  {error&&<p role="alert" className="admin-error">{error}</p>}
  {codes.length>0&&<div role="status">
   <p><strong>One-time display:</strong> {codes.length} synthetic codes from batch {batch}.
    Copy them securely for fake-member UAT. Reloading will erase the displayed secrets.</p>
   <textarea readOnly aria-label="One-time synthetic E-PIN codes" rows={Math.min(12,codes.length+1)} value={codes.join('\n')}/>
  </div>}
 </section></>;
}
