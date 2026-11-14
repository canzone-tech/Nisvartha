'use client';
import {FormEvent,useCallback,useEffect,useState} from 'react';

type PayoutProfile={
 hasBank:boolean;hasUpi:boolean;defaultMethod:'BANK'|'UPI'|null;
 bankMask:string|null;upiMask:string|null;updatedAt:string|null
};
export function MemberPayoutProfile(){
 const [profile,setProfile]=useState<PayoutProfile|null>(null);
 const [method,setMethod]=useState<'BANK'|'UPI'>('BANK');
 const [holderName,setHolderName]=useState('');
 const [accountNumber,setAccountNumber]=useState('');
 const [ifsc,setIfsc]=useState('');
 const [upiId,setUpiId]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const refresh=useCallback(async()=>{
  const response=await fetch('/api/member/actions/payout-profile',{cache:'no-store'});
  const result=await response.json().catch(()=>null);
  if(!response.ok)throw Error('Unable to load payout profile');
  if(!result||typeof result.hasBank!=='boolean'||typeof result.hasUpi!=='boolean')
   throw Error('Unexpected payout profile response');
  setProfile(result as PayoutProfile);
  setMethod((result.defaultMethod as 'BANK'|'UPI'|null)??'BANK');
 },[]);
 useEffect(()=>{let active=true;void Promise.resolve().then(async()=>{
  try{if(active)await refresh()}
  catch(e){if(active)setError(e instanceof Error?e.message:'Unable to load payout details')}
 });return()=>{active=false}},[refresh]);
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy)return;
  const anyBank=Boolean(holderName.trim()||accountNumber.trim()||ifsc.trim());
  if(anyBank&&(!holderName.trim()||!accountNumber.trim()||!ifsc.trim())){
   setError('To replace Bank details, provide holder name, account number and IFSC together.');
   return;
  }
  const payload={
   defaultMethod:method,
   ...(anyBank?{holderName:holderName.trim(),accountNumber:accountNumber.trim(),ifsc:ifsc.trim().toUpperCase()}:{}),
   ...(upiId.trim()?{upiId:upiId.trim()}:{}),
  };
  setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/member/actions/payout-profile',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
   });
   const result=await response.json().catch(()=>null);
   if(!response.ok)throw Error(Array.isArray(result?.message)?
    result.message.join(', '):typeof result?.message==='string'?result.message:'Unable to save payout details');
   await refresh();
   setHolderName('');setAccountNumber('');setIfsc('');setUpiId('');
   setNotice('Default payout destination saved securely. Existing payout requests are unchanged.');
  }catch(err){setError(err instanceof Error?err.message:'Unable to save payout details')}
  finally{setBusy(false)}
 }
 return <section className="admin-panel" aria-label="Saved payout destination">
  <h3>Bank / UPI payment details</h3>
  <p>Save one or both destinations and select the default. New payout requests
   keep a protected snapshot of the default details at request time.</p>
  {profile&&<div className="foundation-admin-stats" aria-label="Saved payment methods">
   <div><strong>{profile.hasBank?profile.bankMask:'Not saved'}</strong><span>Bank</span></div>
   <div><strong>{profile.hasUpi?profile.upiMask:'Not saved'}</strong><span>UPI</span></div>
   <div><strong>{profile.defaultMethod??'Not set'}</strong><span>Default</span></div>
  </div>}
  <form className="admin-form" onSubmit={e=>void save(e)}>
   <label>Default payment method
    <select value={method} onChange={e=>setMethod(e.target.value as 'BANK'|'UPI')}>
     <option value="BANK">Bank transfer</option><option value="UPI">UPI</option>
    </select>
   </label>
   <p>Enter Bank details together to save or replace them; leave blank to retain saved Bank details.</p>
   <label>Account holder name<input value={holderName} maxLength={120}
    pattern="[A-Za-z][A-Za-z .'-]{1,119}" autoComplete="off"
    onChange={e=>setHolderName(e.target.value)}/></label>
   <label>Bank account number<input value={accountNumber} type="text" inputMode="numeric"
    minLength={6} maxLength={18} pattern="[0-9]{6,18}" autoComplete="off"
    onChange={e=>setAccountNumber(e.target.value)}/></label>
   <label>IFSC code<input value={ifsc} maxLength={11}
    pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" autoComplete="off"
    onChange={e=>setIfsc(e.target.value.toUpperCase())}/></label>
   <p>Enter a UPI ID to save or replace it; leave blank to retain an existing UPI ID.</p>
   <label>UPI ID<input value={upiId} maxLength={151}
    pattern="[A-Za-z0-9._-]{2,100}@[A-Za-z]{2,50}" autoComplete="off"
    placeholder="member@bank" onChange={e=>setUpiId(e.target.value)}/></label>
   {error&&<p className="admin-error" role="alert">{error}</p>}
   {notice&&<p className="admin-success" role="status">{notice}</p>}
   <button type="submit" className="button" disabled={busy||!profile}>
    {busy?'Saving…':'Save payment details'}</button>
  </form>
  <p className="foundation-admin-footnote">Full saved account details are not displayed back on this page.
   Update them by entering replacement details. No payment is initiated by saving.</p>
 </section>;
}
