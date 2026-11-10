'use client';
import {FormEvent,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {parseRupeesToPaise} from '@/lib/wallet-amount';

export type MemberWalletView={
 wallet:{earnedPaise:number;legacySettledPaise:number;reservedPaise:number;
  paidPaise:number;availablePaise:number;totalEarnedPaise:number};
 payouts:Array<{id:string;amountPaise:number;status:'REQUESTED'|'PAID'|'REJECTED';
  createdAt:string;decidedAt:string|null;settlementReference:string|null;
  paidAt:string|null;rejectionReason:string|null}>;
 canRequest:boolean;
};
const money=(value:number)=>'₹'+(value/100).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
export function MemberWallet({data}:{data:MemberWalletView}){
 const router=useRouter();
 const [amount,setAmount]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const pending=useRef<{amountPaise:number;requestKey:string}|null>(null);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy||!data.canRequest)return;
  const amountPaise=parseRupeesToPaise(amount);
  if(amountPaise===null){
   setError('Enter a positive amount in rupees, with up to two decimal places.');return;
  }
  if(pending.current?.amountPaise!==amountPaise)
   pending.current={amountPaise,requestKey:crypto.randomUUID()};
  setBusy(true);setError('');setNotice('');
  try{
   const result=await fetch('/api/member/actions/payout',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify(pending.current)});
   const data=await result.json().catch(()=>null);
   if(!result.ok)throw Error(data?.message||'Could not request payout');
   pending.current=null;
   setAmount('');
   setNotice('Payout request submitted.');
   router.refresh();
  }catch(err){
   setError(err instanceof Error?err.message:'Unable to request payout');
  }finally{setBusy(false)}
 }
 return <section className="admin-panel" aria-label="Member wallet">
  <h2>Wallet</h2>
  <div className="foundation-admin-stats">
   <div><strong>{money(data.wallet.availablePaise)}</strong><span>Available</span></div>
   <div><strong>{money(data.wallet.reservedPaise)}</strong><span>Requested</span></div>
   <div><strong>{money(data.wallet.paidPaise)}</strong><span>Paid</span></div>
  </div>
  <p>Total earned: <strong>{money(data.wallet.totalEarnedPaise)}</strong></p>
  {data.canRequest&&<form className="admin-form" onSubmit={submit}>
   <label>Payout amount (₹)
    <input type="number" min="0.01" max="20000000" step="0.01" inputMode="decimal"
     value={amount} onChange={e=>setAmount(e.target.value)} required/>
   </label>
   {error&&<p className="admin-error" role="alert">{error}</p>}
   {notice&&<p className="admin-success" role="status">{notice}</p>}
   <button type="submit" className="button green" disabled={busy||data.wallet.availablePaise<1}>
    {busy?'Submitting…':'Request payout'}
   </button>
  </form>}
  {!data.canRequest&&<p role="status">Payout requests are currently unavailable.</p>}
  <h3>Payout history</h3>
  {data.payouts.length===0?<p>No payout requests yet.</p>:
   <div className="table-scroll"><table>
    <thead><tr><th>Requested</th><th>Amount</th><th>Status</th><th>Reference</th></tr></thead>
    <tbody>{data.payouts.map(payout=><tr key={payout.id}>
     <td>{new Date(payout.createdAt).toLocaleDateString('en-IN')}</td>
     <td>{money(payout.amountPaise)}</td>
     <td>{payout.status==='REQUESTED'?'Pending':payout.status==='PAID'?'Paid':'Rejected'}</td>
     <td>{payout.settlementReference??'—'}</td>
    </tr>)}</tbody>
   </table></div>}
 </section>;
}
