'use client';
import {FormEvent,useCallback,useEffect,useRef,useState} from 'react';
import {localExpiryToUtcIso} from '@/lib/epin-expiry';


type PinStatus='ALL'|'AVAILABLE'|'USED'|'EXPIRED';
type PinRecord={id:string;batchId:string;displaySuffix:string;code:string|null;expiresAt:string;
 createdAt:string;redeemedAt:string|null;redeemedByMemberId:string|null;
 batchQuantity:number;batchCreatedAt:string;status:Exclude<PinStatus,'ALL'>};
type PinInventory={classification:'SYNTHETIC_NONFINANCIAL_UAT_ONLY'|'NONFINANCIAL_REGISTRATION_ACCESS';total:number;
 counts:{available:number;used:number;expired:number};status:PinStatus;
 items:PinRecord[];nextCursor:string|null};
const filters:PinStatus[]=['ALL','AVAILABLE','USED','EXPIRED'];
type PinMode='synthetic'|'access';
const pinEndpoint=(mode:PinMode)=>mode==='synthetic'?'uat-pins':'registration-pins';
const pinClassification=(mode:PinMode)=>mode==='synthetic'?'SYNTHETIC_NONFINANCIAL_UAT_ONLY':'NONFINANCIAL_REGISTRATION_ACCESS';
function PinInventoryList({refreshKey,mode}:{refreshKey:number;mode:PinMode}){
 const [filter,setFilter]=useState<PinStatus>('ALL'),[items,setItems]=useState<PinRecord[]>([]);
 const [nextCursor,setNextCursor]=useState<string|null>(null);
 const [counts,setCounts]=useState<PinInventory['counts']|null>(null);
 const [total,setTotal]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=useCallback(async(cursor:string|null,append:boolean)=>{
  setBusy(true);setError('');
  try{
   const query=new URLSearchParams({status:filter});
   if(cursor)query.set('cursor',cursor);
   const response=await fetch('/api/admin/backend/cms/membership/'+pinEndpoint(mode)+'?'+query,{cache:'no-store'});
   const data:PinInventory=await response.json();
   if(!response.ok)throw Error('Unable to load E-PIN inventory');
   if(data.classification!==pinClassification(mode)||
      !Array.isArray(data.items)||data.items.length>50||
      !data.items.every(pin=>typeof pin.id==='string'&&
        typeof pin.displaySuffix==='string'&&
        (pin.code===null||(typeof pin.code==='string'&&/^[A-Za-z0-9_-]{43}$/.test(pin.code)))&&
        /^(AVAILABLE|USED|EXPIRED)$/.test(pin.status)))
    throw Error('Unexpected E-PIN inventory response');
   setItems(previous=>append?[...previous,...data.items]:data.items);
   setNextCursor(data.nextCursor);
   setCounts(data.counts);setTotal(data.total);
  }catch(err){setError(err instanceof Error?err.message:'E-PIN inventory unavailable')}
  finally{setBusy(false)}
 },[filter,mode]);
 useEffect(()=>{void Promise.resolve().then(()=>load(null,false))},[load,refreshKey]);
 return <section className="admin-panel admin-pin-inventory">
  <div className="admin-heading"><div>
   <h2>Registration E-PIN inventory</h2>
   <p>{mode==='synthetic'?'Disposable synthetic UAT inventory.':'Admin-issued nonfinancial registration access inventory.'} Full codes are visible to Admin for encrypted records. Legacy hash-only PINs cannot be recovered. No purchase, wallet or payout information.</p>
  </div><button className="button alt" type="button" disabled={busy}
   onClick={()=>void load(null,false)}>Refresh list</button></div>
  {counts&&<div className="foundation-admin-stats" aria-label="E-PIN inventory totals">
   <div><strong>{total}</strong><span>All registration PINs</span></div>
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
  {!busy&&!error&&items.length===0&&<p>No matching registration PINs.</p>}
  {items.length>0&&<div className="table-scroll"><table className="admin-pin-table">
   <thead><tr><th>Registration PIN</th><th>Status</th><th>Batch</th><th>Created</th><th>Expiry</th><th>Member</th></tr></thead>
   <tbody>{items.map(pin=><tr key={pin.id}>
    <td>{pin.code?<code className="admin-pin-full-code" aria-label="Full registration PIN">{pin.code}</code>:
     <span title="Legacy hash-only PIN; the full code cannot be recovered"><code>••••••{pin.displaySuffix}</code> <small>(legacy)</small></span>}</td>
    <td><span className="admin-pin-status">{pin.status}</span></td>
    <td><code title={pin.batchId}>{pin.batchId.slice(0,8)}</code></td>
    <td>{new Date(pin.createdAt).toLocaleDateString()}</td>
    <td>{new Date(pin.expiresAt).toLocaleString()}</td>
    <td>{pin.redeemedByMemberId?<code title={pin.redeemedByMemberId}>{pin.redeemedByMemberId.slice(0,8)}</code>:'—'}</td>
   </tr>)}</tbody>
  </table></div>}
  {nextCursor&&<button className="button alt" type="button" disabled={busy}
   onClick={()=>void load(nextCursor,true)}>Load more PINs</button>}
  <p className="foundation-admin-footnote">Encrypted PINs remain visible to authenticated Admin, including used and expired records. Every full-code inventory read is audited. Older hash-only PINs stay masked.</p>
 </section>;
}

/** One operational form; no duplicate policy-validation form. */
export function AdminRegistrationPins({mode}:{mode:PinMode}){
 const [quantity,setQuantity]=useState('3');
 const [expiresAt,setExpiresAt]=useState('');
 const [codes,setCodes]=useState<string[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [batch,setBatch]=useState('');
 const [copied,setCopied]=useState(false);
 const codePanel=useRef<HTMLDivElement>(null);
 const [refreshKey,setRefreshKey]=useState(0);
 // Retain the key across network timeouts; only a confirmed creation can retire it.
 const pendingRequestKey=useRef<string|null>(null);
 useEffect(()=>{
  if(codes.length>0){
   codePanel.current?.focus();
   codePanel.current?.scrollIntoView({block:'nearest'});
  }
 },[codes]);
 async function copyCodes(){
  try{
   await navigator.clipboard.writeText(codes.join('\n'));
   setCopied(true);
  }catch{
   setError('Automatic copy was blocked. Select and copy the codes manually.');
  }
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const expiry=localExpiryToUtcIso(expiresAt);
  if(!expiry){setError('Choose a valid date and time');return}
  if(codes.length>0){setError('Save or copy the current batch before creating another.');return}
  setBusy(true);setError('');setCopied(false);
  try{
   const requestKey=pendingRequestKey.current??crypto.randomUUID();
   pendingRequestKey.current=requestKey;
   const response=await fetch('/api/admin/backend/cms/membership/'+pinEndpoint(mode),{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({quantity:Number(quantity),expiresAt:expiry,requestKey})
   });
   const result=await response.json().catch(()=>null);
   if(!response.ok)throw Error(typeof result?.message==='string'?result.message:'Unable to create registration PINs');
   if(result?.classification!==pinClassification(mode)||
      !Array.isArray(result.codes)||result.codes.length!==Number(quantity))
     throw Error('Invalid registration PIN batch response');
   setCodes(result.codes);setBatch(result.batchId);setRefreshKey(x=>x+1);
   pendingRequestKey.current=null;
  }catch(err){setError((err instanceof Error?err.message:'Registration PIN request failed')+
   '. If the request may have succeeded, refresh inventory before attempting another batch.')}
  finally{setBusy(false)}
 }
 return <><section className="admin-panel admin-pin-creator">
  <h2>{mode==='synthetic'?'Generate synthetic registration E-PINs (UAT only)':'Create registration E-PINs (Admin only)'}</h2>
  <p>{mode==='synthetic'
   ?'Disposable local UAT only: use fictional applicants and no real data.'
   :'No-fee, single-use registration access only. Applicant approval remains separate.'}
   {' '}These codes never collect fees, issue paid E-PINs, activate memberships or grant commissions.
   Admin can view encrypted codes later in inventory; distribute them securely.</p>
  <form className="admin-form" onSubmit={submit}>
   <label>Quantity (1–50)<input type="number" min={1} max={50} step={1}
    value={quantity} onChange={e=>setQuantity(e.target.value)} required/></label>
   <label>Expiry date and time (device local time)
    <input type="datetime-local" step={60} value={expiresAt} onChange={e=>setExpiresAt(e.target.value)} required/>
   </label>
   {expiresAt&&<p>UTC expiry: {localExpiryToUtcIso(expiresAt)||'Invalid date or time'}</p>}
   <button className="button" disabled={busy||codes.length>0}>
    {busy?'Generating…':codes.length>0?'Save current PINs to create another batch':'Generate registration E-PINs'}</button>
  </form>
  {error&&<p role="alert" className="admin-error">{error}</p>}
  {codes.length>0&&<div className="admin-pin-issued" ref={codePanel} tabIndex={-1}
   role="region" aria-label="Newly generated E-PINs">
   <h3>Generated E-PINs — available in Admin inventory</h3>
   <p role="status"><strong>{codes.length} PINs generated successfully.</strong> Batch: <code>{batch}</code></p>
   <p>Full PINs are encrypted at rest and remain visible to authenticated Admin in inventory.
    Every retrieval is audited. Copy codes only for secure distribution.</p>
   <label htmlFor="issued-registration-pins">Generated registration E-PIN codes</label>
   <textarea id="issued-registration-pins" readOnly spellCheck={false}
    aria-label="Generated registration E-PIN codes" rows={Math.min(12,codes.length+1)}
    value={codes.join('\n')}/>
   <div className="admin-pin-issued-actions">
    <button type="button" className="button" onClick={()=>void copyCodes()}>
     {copied?'Copied':'Copy all PINs'}</button>
    <button type="button" className="button alt" onClick={()=>{
     if(!window.confirm('Clear this on-screen copy? Encrypted PINs remain in Admin inventory.'))return;
     setCodes([]);setBatch('');setCopied(false);setError('');
    }}>I have saved these codes — create another batch</button>
   </div>
   {copied&&<p role="status" className="foundation-admin-footnote">
    Copied to your clipboard. Clear the clipboard after secure distribution.</p>}
  </div>}
 </section><PinInventoryList refreshKey={refreshKey} mode={mode}/></>;
}

/** Preserve the existing synthetic UAT entrypoint without duplicating behavior. */
export function AdminUatSignupPins(){return <AdminRegistrationPins mode="synthetic"/>}
