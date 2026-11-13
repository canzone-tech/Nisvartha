'use client';
import {FormEvent,useEffect,useState} from 'react';

type Rates={joiningAmountPaise:number;directReferralPaise:number;level1Paise:number;
 level2Paise:number;level3Paise:number;level4Paise:number;level5Paise:number;
 rebirthAtLevel4:number;rebirthAtLevel5:number};
type Version=Rates&{id:number;reason:string;publishedAt:string;createdBy:{email:string}|null};
type Response={activeVersionId:number;revision:number;matrixWidth:number;maximumLevel:number;
 versions:Version[]};
const FIELDS=[
 ['joiningAmountPaise','Joining price (₹)'],
 ['level1Paise','Level 1 earning (₹)'],['level2Paise','Level 2 earning (₹)'],
 ['level3Paise','Level 3 earning (₹)'],['level4Paise','Level 4 earning (₹)'],
 ['level5Paise','Level 5 earning (₹)'],['rebirthAtLevel4','Rebirth IDs at level 4'],
 ['rebirthAtLevel5','Rebirth IDs at level 5']
] as const;
type Key=typeof FIELDS[number][0];
const rupees=(paise:number)=>'₹'+(paise/100).toLocaleString('en-IN');
const display=(key:Key,value:number)=>key.startsWith('rebirth')?String(value):rupees(value);
const makeForm=(version:Version)=>Object.fromEntries(FIELDS.map(([key])=>[
 key,key.startsWith('rebirth')?String(version[key]):String(version[key]/100)
])) as Record<Key,string>;

export function AdminFinancialPlan(){
 const [data,setData]=useState<Response|null>(null);
 const [form,setForm]=useState<Record<Key,string>|null>(null);
 const [reason,setReason]=useState('');
 const [pendingKey,setPendingKey]=useState<string|null>(null);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 async function reload(){
  const response=await fetch('/api/admin/backend/cms/membership/financial-plan',{cache:'no-store'});
  const value=await response.json().catch(()=>null);
  if(!response.ok||!Array.isArray(value?.versions)||
     !Number.isSafeInteger(value?.activeVersionId))throw Error('Unable to load current financial rules');
  const active=(value as Response).versions.find(x=>x.id===value.activeVersionId);
  if(!active)throw Error('Current financial rule version missing');
  setData(value as Response);setForm(makeForm(active));setReason('');setPendingKey(null);
 }
 useEffect(()=>{void Promise.resolve().then(reload).catch(e=>setError(
  e instanceof Error?e.message:'Unable to load financial rules'))},[]);
 async function publish(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||!data||!form)return;
  const rates:Record<string,number>={};
  for(const [key] of FIELDS){
   const literal=form[key].trim();
   if(!/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/.test(literal)){
    setError('Enter nonnegative numbers with at most two decimal places');return;
   }
   const number=Number(literal);
   const amount=key.startsWith('rebirth')?number:Math.round(number*100);
   if(!Number.isSafeInteger(amount)||(key.startsWith('rebirth')&&!Number.isInteger(number))){
    setError('Invalid amount or rebirth count');return;
   }
   rates[key]=amount;
  }
  if(reason.trim().length<8){setError('Please provide an 8–500 character change reason');return}
  const requestKey=pendingKey??crypto.randomUUID();setPendingKey(requestKey);
  setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/admin/backend/cms/membership/financial-plan/publish',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...rates,directReferralPaise:0,reason:reason.trim(),expectedVersionId:data.activeVersionId,
     requestKey})
   });
   const payload=await response.json().catch(()=>null);
   if(!response.ok)throw Error(Array.isArray(payload?.message)?
    payload.message.join(', '):payload?.message||'Publishing failed');
   setNotice('New financial plan version published. Existing members and earnings remain unchanged.');
   await reload();
  }catch(e){setError(e instanceof Error?e.message:'Publishing rejected')}
  finally{setBusy(false)}
 }
 if(error&&!data)return <p role="alert" className="admin-error">{error}</p>;
 const active=data?.versions.find(x=>x.id===data.activeVersionId);
 return <section className="admin-panel" aria-label="Financial plan versions">
  <h2>Business rules &amp; level income plan</h2>
  <p>Authoritative, audited rules for future registrations. Each member keeps the
   version assigned at signup; existing balances, earnings and payout records never recalculate.</p>
  <p><strong>Fixed matrix topology:</strong> 1:3 breadth-first · 5 levels ·
   new rebirth positions go to the next available slots.</p>
  {!active&&<p role="status">Loading versioned rules…</p>}
  {active&&form&&<><p><strong>Active version #{active.id}</strong> ·
   Published {new Date(active.publishedAt).toLocaleString('en-IN')}</p>
   <form className="admin-form" onSubmit={publish}>
    {FIELDS.map(([key,label])=><label key={key}>{label}
     <input type="number" step={key.startsWith('rebirth')?'1':'0.01'}
      min={key==='joiningAmountPaise'?'100': '0'}
      max={key.startsWith('rebirth')?'8':undefined}
      value={form[key]} disabled={busy} required
      onChange={event=>{setForm(before=>before?{...before,[key]:event.target.value}:before);
       setPendingKey(null);setError('')}}/>
    </label>)}
    <label>Reason for this new version (audit trail)
     <textarea minLength={8} maxLength={500} required disabled={busy}
      value={reason} onChange={e=>{setReason(e.target.value);setPendingKey(null)}}/>
    </label>
    <p>Publishing applies to future paid E-PIN batches and new members. E-PINs
     already issued retain their original plan and amount. No historical financial record
     will be edited. Real paid issuance requires independently verified payment evidence.</p>
    <button type="submit" className="button" disabled={busy}>
     {busy?'Publishing…':'Publish new version'}</button>
   </form>
  </>}
  {error&&<p className="admin-error" role="alert">{error}</p>}
  {notice&&<p className="admin-success" role="status">{notice}</p>}
  {data&&<section aria-label="Financial plan revision history">
   <h3>Immutable version history</h3>
   <div className="cms-list">{data.versions.map(v=><article className="cms-row" key={v.id}>
    <div><strong>Version #{v.id} {v.id===data.activeVersionId?'(active)':''}</strong>
     <p>{new Date(v.publishedAt).toLocaleString('en-IN')} · {v.createdBy?.email??'System baseline'}</p>
     <p>{v.reason}</p><p>Joining {display('joiningAmountPaise',v.joiningAmountPaise)}</p>
     <p>Levels: {[1,2,3,4,5].map(level=>display(
      ('level'+level+'Paise') as Key,v[('level'+level+'Paise') as Key])).join(' / ')}</p>
     <p>Rebirth: L4 {v.rebirthAtLevel4} · L5 {v.rebirthAtLevel5}</p>
    </div>
   </article>)}</div>
  </section>}
 </section>;
}
