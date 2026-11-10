'use client';
import {Fragment,FormEvent,useCallback,useEffect,useRef,useState} from 'react';
import {localExpiryToUtcIso} from '@/lib/epin-expiry';


type PinStatus='ALL'|'AVAILABLE'|'USED'|'EXPIRED'|'CANCELLED'|'REFUNDED';
type PinRecord={id:string;batchId:string;displaySuffix:string;code:string|null;expiresAt:string|null;
 createdAt:string;redeemedAt:string|null;redeemedByMemberId:string|null;
 batchQuantity:number;batchCreatedAt:string;status:Exclude<PinStatus,'ALL'>;
 accounting?:'LEGACY'|'VERIFIED_PAID';unitAmountPaise?:number|null;paidBankReference?:string|null;
 cancelledAt?:string|null;cancellationReason?:string|null;
 refund?:{bankReference:string;evidenceRef:string;paidAt:string;recordedAt:string}|null};
type PinInventory={classification:'SYNTHETIC_NONFINANCIAL_UAT_ONLY'|'REGISTRATION_ACCESS';total:number;
 counts:{available:number;used:number;expired:number;cancelled?:number;refunded?:number};
 matchingTotal?:number;status:PinStatus;
 items:PinRecord[];nextCursor:string|null};
const filters:PinStatus[]=['ALL','AVAILABLE','USED','EXPIRED','CANCELLED','REFUNDED'];
type AccountingFilter='ALL'|'LEGACY'|'VERIFIED_PAID';
type PaidSummary={currency:'INR';unitAmountPaise:number;verifiedBatchCount:number;
 paidPinCount:number;usedPaidPinCount:number;availablePaidPinCount:number;
 cancelledRefundPendingCount:number;refundedPinCount:number;
 grossPaidPaise:number;refundPendingPaise:number;refundedPaise:number;
 netReceivedAfterRefundPaise:number};
const rupees=(paise:number)=>'₹'+(paise/100).toLocaleString('en-IN',{
 minimumFractionDigits:2,maximumFractionDigits:2});
export function AdminPaidPinSummary({refreshKey=0}:{refreshKey?:number}){
 const [data,setData]=useState<PaidSummary|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{let active=true;void Promise.resolve().then(async()=>{
  try{
   const response=await fetch('/api/admin/backend/cms/membership/registration-pins/paid-summary',
    {cache:'no-store'});
   const result=await response.json().catch(()=>null);
   if(!response.ok||!result||result.currency!=='INR'||
      result.unitAmountPaise!==1_500_000||
      !Number.isSafeInteger(result.grossPaidPaise))
    throw Error('Verified paid amount summary unavailable');
   if(active){setData(result as PaidSummary);setError('')}
  }catch(err){if(active){setData(null);setError(err instanceof Error?err.message:'Summary unavailable')}}
 });return()=>{active=false}},[refreshKey]);
 return <section className="admin-panel" aria-label="Verified paid E-PIN accounting">
  <h2>Verified paid amount (new E-PINs only)</h2>
  <p>Legacy E-PINs are excluded. A cancelled PIN remains paid until an actual
   offline refund is recorded. These totals are not a commission budget.</p>
  {error&&<p role="alert" className="admin-error">{error}</p>}
  {!data&&!error&&<p role="status">Loading paid amount totals…</p>}
  {data&&<div className="foundation-admin-stats" aria-label="Paid amount totals">
   <div><strong>{rupees(data.grossPaidPaise)}</strong><span>Verified gross paid</span></div>
   <div><strong>{rupees(data.refundPendingPaise)}</strong><span>Cancelled, refund pending</span></div>
   <div><strong>{rupees(data.refundedPaise)}</strong><span>Offline refunds completed</span></div>
   <div><strong>{rupees(data.netReceivedAfterRefundPaise)}</strong><span>Net after refunds</span></div>
   <div><strong>{data.paidPinCount}</strong><span>Verified paid PINs</span></div>
   <div><strong>{data.availablePaidPinCount}</strong><span>Available paid PINs</span></div>
  </div>}
 </section>;
}
type PinMode='legacy'|'access';
const pinEndpoint=(mode:PinMode)=>mode==='legacy'?'uat-pins':'registration-pins';
const pinClassification=(mode:PinMode)=>mode==='legacy'?'SYNTHETIC_NONFINANCIAL_UAT_ONLY':'REGISTRATION_ACCESS';
/** Cancel only unused PINs. Recording a completed refund is a separate
 * explicit Admin action with durable external transfer evidence.
 */
function PinLifecycleActions({pin,onDone}:{pin:PinRecord;onDone:()=>void}){
 const [reason,setReason]=useState('');
 const [reference,setReference]=useState('');
 const [evidence,setEvidence]=useState('');
 const [paidAt,setPaidAt]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const key=useRef<string|null>(null);
 const operation=pin.status==='CANCELLED'?'refund':'cancel';
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  const requestKey=key.current??crypto.randomUUID();key.current=requestKey;
  setBusy(true);setError('');setNotice('');
  try{
   const body=operation==='cancel'?{requestKey,reason:reason.trim()}:{
    requestKey,bankReference:reference.trim().toUpperCase(),
    evidenceRef:evidence.trim().toUpperCase(),paidAt:new Date(paidAt).toISOString()
   };
   const response=await fetch('/api/admin/backend/cms/membership/registration-pins/'+
    pin.id+'/'+operation,{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const result=await response.json().catch(()=>null);
   if(!response.ok)throw Error(Array.isArray(result?.message)?
    result.message.join(', '):typeof result?.message==='string'?result.message:
    'Unable to update PIN');
   key.current=null;
   setNotice(operation==='cancel'?'PIN cancelled — refund still pending':
    'Offline refund reference recorded and audited');
   onDone();
  }catch(err){setError(err instanceof Error?err.message:'Operation failed')}
  finally{setBusy(false)}
 }
 if(pin.status==='REFUNDED')return <p>Refund completed offline:
  <code> {pin.refund?.bankReference}</code> · {pin.refund?.paidAt&&
    new Date(pin.refund.paidAt).toLocaleString('en-IN')}</p>;
 if(pin.status==='USED')return <p>Used PIN cannot be cancelled or refunded.</p>;
 return <form className="admin-form" onSubmit={event=>void submit(event)}>
  <p>{operation==='cancel'?'Revoke an unused PIN. This does not refund money.':
   'Record an external refund only AFTER the offline transfer is completed.'}</p>
  {operation==='cancel'?<label>Cancellation reason
   <textarea required minLength={8} maxLength={500}
    value={reason} onChange={event=>setReason(event.target.value)}/>
  </label>:<>
   <label>Offline refund bank reference
    <input required minLength={6} maxLength={80}
     pattern="[A-Za-z0-9][A-Za-z0-9/_-]{5,79}"
     value={reference} onChange={event=>setReference(event.target.value)}/>
   </label>
   <label>Refund evidence reference
    <input required minLength={6} maxLength={120}
     pattern="[A-Za-z0-9][A-Za-z0-9_-]{5,119}"
     value={evidence} onChange={event=>setEvidence(event.target.value.toUpperCase())}/>
   </label>
   <label>Actual offline refund completion date/time
    <input required type="datetime-local" value={paidAt}
     onChange={event=>setPaidAt(event.target.value)}/>
   </label>
  </>}
  {error&&<p role="alert" className="admin-error">{error}</p>}
  {notice&&<p role="status" className="admin-success">{notice}</p>}
  <button disabled={busy} type="submit" className="button">
   {busy?'Saving…':operation==='cancel'?'Cancel unused PIN':'Confirm completed offline refund'}
  </button>
 </form>;
}
function PinInventoryList({refreshKey,mode}:{refreshKey:number;mode:PinMode}){
 const [filter,setFilter]=useState<PinStatus>('ALL'),[items,setItems]=useState<PinRecord[]>([]);
 const [accounting,setAccounting]=useState<AccountingFilter>('ALL');
 const [matchingTotal,setMatchingTotal]=useState(0);
 const [cursor,setCursor]=useState<string|null>(null);
 const [history,setHistory]=useState<(string|null)[]>([]);
 const [nextCursor,setNextCursor]=useState<string|null>(null);
 const [counts,setCounts]=useState<PinInventory['counts']|null>(null);
 const [total,setTotal]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [openId,setOpenId]=useState<string|null>(null);
 const [localRefresh,setLocalRefresh]=useState(0);
 function updated(){setOpenId(null);setHistory([]);setCursor(null);setLocalRefresh(x=>x+1)}
 const load=useCallback(async()=>{
  setBusy(true);setError('');
  try{
   const query=new URLSearchParams({status:filter});
   if(mode==='access')query.set('accounting',accounting);
   if(cursor)query.set('cursor',cursor);
   const response=await fetch('/api/admin/backend/cms/membership/'+pinEndpoint(mode)+'?'+query,{cache:'no-store'});
   const data:PinInventory=await response.json();
   if(!response.ok)throw Error('Unable to load E-PIN inventory');
   if(data.classification!==pinClassification(mode)||
      !Array.isArray(data.items)||data.items.length>50||
      !data.items.every(pin=>typeof pin.id==='string'&&
        typeof pin.displaySuffix==='string'&&
        (pin.code===null||(typeof pin.code==='string'&&/^[A-Za-z0-9_-]{43}$/.test(pin.code)))&&
        /^(AVAILABLE|USED|EXPIRED|CANCELLED|REFUNDED)$/.test(pin.status)))
    throw Error('Unexpected E-PIN inventory response');
   setItems(data.items);
   setNextCursor(data.nextCursor);
   setCounts(data.counts);setTotal(data.total);
   setMatchingTotal(data.matchingTotal??data.total);
  }catch(err){setError(err instanceof Error?err.message:'E-PIN inventory unavailable')}
  finally{setBusy(false)}
 },[filter,mode,cursor,accounting]);
 useEffect(()=>{void Promise.resolve().then(load)},[load,refreshKey,localRefresh]);
 function changeAccounting(next:AccountingFilter){
  setAccounting(next);setCursor(null);setHistory([]);setOpenId(null);
 }
 function changeFilter(next:PinStatus){
  setFilter(next);setCursor(null);setHistory([]);setOpenId(null);
 }
 function nextPage(){
  if(!nextCursor||busy)return;
  setHistory(previous=>[...previous,cursor]);setCursor(nextCursor);
 }
 function previousPage(){
  if(!history.length||busy)return;
  setCursor(history[history.length-1]);setHistory(previous=>previous.slice(0,-1));
 }
 return <section className="admin-panel admin-pin-inventory">
  <div className="admin-heading"><div>
   <h2>Registration E-PIN inventory</h2>
   <p>Admin-issued registration E-PIN inventory. Full codes are visible to Admin for encrypted records. Legacy hash-only PINs cannot be recovered.</p>
  </div><button className="button alt" type="button" disabled={busy}
   onClick={()=>void load()}>Refresh list</button></div>
  {counts&&<div className="foundation-admin-stats" aria-label="E-PIN inventory totals">
   <div><strong>{total}</strong><span>All registration PINs</span></div>
   <div><strong>{counts.available}</strong><span>Available</span></div>
   <div><strong>{counts.used}</strong><span>Used</span></div>
   <div><strong>{counts.expired}</strong><span>Expired</span></div>
   {mode==='access'&&<div><strong>{counts.cancelled??0}</strong><span>Cancelled · refund pending</span></div>}
   {mode==='access'&&<div><strong>{counts.refunded??0}</strong><span>Refunded (bank reference recorded)</span></div>}
  </div>}
  <div className="admin-pin-filters" role="group" aria-label="Filter E-PIN status">
   {filters.filter(item=>mode==='access'||!['CANCELLED','REFUNDED'].includes(item)).map(item=><button type="button" key={item} disabled={busy}
    className={item===filter?'active':''} aria-pressed={item===filter}
    onClick={()=>changeFilter(item)}>{item==='ALL'?'All':item[0]+item.slice(1).toLowerCase()}</button>)}
  </div>
  {mode==='access'&&<label className="admin-reason">Payment record
   <select value={accounting} disabled={busy}
    onChange={e=>changeAccounting(e.target.value as AccountingFilter)}>
    <option value="ALL">All E-PINs</option>
    <option value="VERIFIED_PAID">New verified paid</option>
    <option value="LEGACY">Legacy / no verified paid record</option>
   </select>
  </label>}
  {error&&<p className="admin-error" role="alert">{error}</p>}
  <p role="status">{busy?'Loading inventory…':
   'Page '+(history.length+1)+' · '+items.length+' shown · '+matchingTotal+' matching · '+total+' total E-PINs'}</p>
  {!busy&&!error&&items.length===0&&<p>No matching registration PINs.</p>}
  {items.length>0&&<div className="table-scroll" role="region" aria-label="E-PIN inventory table" tabIndex={0}><table className="admin-pin-table">
   <thead><tr><th>Registration PIN</th><th>Status</th><th>Batch</th>{mode==='access'&&<th>Paid record</th>}<th>Created</th><th>Expiry</th><th>Member</th>{mode==='access'&&<th>Actions</th>}</tr></thead>
   <tbody>{items.map(pin=><Fragment key={pin.id}><tr>
    <td>{pin.code?<code className="admin-pin-full-code" aria-label="Full registration PIN">{pin.code}</code>:
     <span title="Legacy hash-only PIN; the full code cannot be recovered"><code>••••••{pin.displaySuffix}</code> <small>(legacy)</small></span>}</td>
    <td><span className="admin-pin-status">{pin.status}</span></td>
    <td><code title={pin.batchId}>{pin.batchId.slice(0,8)}</code></td>
    {mode==='access'&&<td>{pin.accounting==='VERIFIED_PAID'?
     <><strong>{rupees(pin.unitAmountPaise??0)}</strong>
      <p><small>Ref: {pin.paidBankReference}</small></p></>:
     <span>Legacy · not counted</span>}</td>}
    <td>{new Date(pin.createdAt).toLocaleDateString()}</td>
    <td>{pin.expiresAt?new Date(pin.expiresAt).toLocaleString():'No expiry'}</td>
    <td>{pin.redeemedByMemberId?<code title={pin.redeemedByMemberId}>{pin.redeemedByMemberId.slice(0,8)}</code>:'—'}</td>
    {mode==='access'&&<td><button type="button" className="button alt"
     disabled={busy||pin.status==='USED'} aria-expanded={openId===pin.id}
     onClick={()=>setOpenId(current=>current===pin.id?null:pin.id)}>
     {openId===pin.id?'Close':pin.status==='REFUNDED'?'Refund record':
      pin.status==='CANCELLED'?'Record refund':'Cancel PIN'}
    </button></td>}
   </tr>
   {mode==='access'&&openId===pin.id&&<tr><td colSpan={mode==='access'?8:6}>
    <PinLifecycleActions pin={pin} onDone={updated}/>
   </td></tr>}
   </Fragment>)}</tbody>
  </table></div>}
  <div className="admin-pin-issued-actions" aria-label="E-PIN inventory pagination">
   <button className="button alt" type="button" disabled={busy||history.length===0}
    onClick={previousPage}>Previous page</button>
   <button className="button alt" type="button" disabled={busy||!nextCursor}
    onClick={nextPage}>Next page</button>
  </div>
  <p className="foundation-admin-footnote">Encrypted PINs remain visible to authenticated Admin, including used and expired records. Every full-code inventory read is audited. Older hash-only PINs stay masked.</p>
 </section>;
}

/** One operational form; no duplicate policy-validation form. */
export function AdminRegistrationPins({mode,saleBacked=false}:{mode:PinMode;saleBacked?:boolean}){
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
  const expiry=mode==='legacy'?localExpiryToUtcIso(expiresAt):null;
  if(mode==='legacy'&&!expiry){setError('Choose a valid date and time');return}
  if(codes.length>0){setError('Save or copy the current batch before creating another.');return}
  setBusy(true);setError('');setCopied(false);
  try{
   const requestKey=pendingRequestKey.current??crypto.randomUUID();
   pendingRequestKey.current=requestKey;
   const response=await fetch('/api/admin/backend/cms/membership/'+pinEndpoint(mode),{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({quantity:Number(quantity),...(expiry?{expiresAt:expiry}:{}),requestKey})
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
  <h2>Create registration E-PINs (Admin only)</h2>
  <p>{saleBacked?'Single-use registration E-PIN. The fixed ₹15,000 offline transaction is confirmed by Admin during approval before activation.':'Single-use registration access code. Applicant approval remains separate.'}
   {' '}{saleBacked?'The E-PIN itself does not process money; it links the registration to the offline-confirmed activation flow.':'Applicant approval remains separate from E-PIN creation.'}
   Admin can view encrypted codes later in inventory; distribute them securely.</p>
  <form className="admin-form" onSubmit={submit}>
   <label>Quantity (1–50)<input type="number" min={1} max={50} step={1}
    value={quantity} onChange={e=>setQuantity(e.target.value)} required/></label>
   {mode==='legacy'&&<>
    <label>Expiry date and time (device local time)
     <input type="datetime-local" step={60} value={expiresAt} onChange={e=>setExpiresAt(e.target.value)} required/>
    </label>
    {expiresAt&&<p>UTC expiry: {localExpiryToUtcIso(expiresAt)||'Invalid date or time'}</p>}
   </>}
   {mode==='access'&&<p>New registration E-PINs do not expire automatically. An unused PIN remains valid until redeemed or revoked.</p>}
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

