'use client';
import {FormEvent,useCallback,useEffect,useRef,useState} from 'react';
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
type HistoryStatus='ALL'|'REQUESTED'|'PAID'|'REJECTED';
type PayoutHistory=MemberWalletView['payouts'][number];
type HistoryPage={status:HistoryStatus;matchingTotal:number;items:PayoutHistory[];nextCursor:string|null};
const PAGE_SIZE=25;
const money=(value:number)=>'₹'+(value/100).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
export function MemberWallet({data}:{data:MemberWalletView}){
 const router=useRouter();
 const [amount,setAmount]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const pending=useRef<{amountPaise:number;requestKey:string}|null>(null);
 const [filter,setFilter]=useState<HistoryStatus>('ALL');
 const [cursor,setCursor]=useState<string|null>(null);
 const [history,setHistory]=useState<(string|null)[]>([]);
 const [page,setPage]=useState<HistoryPage|null>(null);
 const [pageBusy,setPageBusy]=useState(true),[historyError,setHistoryError]=useState('');
 const requestSeq=useRef(0);
 const loadPage=useCallback(async()=>{
  const seq=++requestSeq.current;
  setPageBusy(true);setHistoryError('');
  const query=new URLSearchParams({status:filter,limit:String(PAGE_SIZE)});
  if(cursor)query.set('cursor',cursor);
  try{
   const response=await fetch('/api/member/actions/payouts-page?'+query,{cache:'no-store'});
   const result=await response.json().catch(()=>null) as HistoryPage|null;
   if(!response.ok)throw Error('Payout history unavailable');
   if(!result||!Array.isArray(result.items)||result.items.length>PAGE_SIZE||
      typeof result.matchingTotal!=='number'||
      (result.nextCursor!==null&&typeof result.nextCursor!=='string'))
    throw Error('Unexpected payout history response');
   if(seq===requestSeq.current)setPage(result);
  }catch(err){
   if(seq===requestSeq.current){
    setPage(null);setHistoryError(err instanceof Error?err.message:'Payout history unavailable');
   }
  }finally{if(seq===requestSeq.current)setPageBusy(false)}
 },[filter,cursor]);
 useEffect(()=>{void Promise.resolve().then(loadPage)},[loadPage]);
 function changeFilter(next:HistoryStatus){
  setFilter(next);setCursor(null);setHistory([]);
 }
 function nextPage(){
  if(!page?.nextCursor||pageBusy)return;
  setHistory(prev=>[...prev,cursor]);setCursor(page.nextCursor);
 }
 function previousPage(){
  if(pageBusy||!history.length)return;
  setCursor(history[history.length-1]);setHistory(prev=>prev.slice(0,-1));
 }
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
   setHistory([]);setCursor(null);
   if(cursor===null)void loadPage();
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
  <label>Filter records
   <select value={filter} disabled={pageBusy}
    onChange={e=>changeFilter(e.target.value as HistoryStatus)}>
    <option value="ALL">All</option><option value="REQUESTED">Pending</option>
    <option value="PAID">Paid</option><option value="REJECTED">Rejected</option>
   </select>
  </label>
  <p role="status">{pageBusy?'Loading history…':page?
   page.matchingTotal+' matching payouts · Page '+(history.length+1):'No history loaded'}</p>
  {historyError&&<p className="admin-error" role="alert">{historyError}</p>}
  {page&&!pageBusy&&page.items.length===0&&<p>No matching payout requests.</p>}
  {page&&page.items.length>0&&<div className="table-scroll" role="region"
   aria-label="Member payout history table" tabIndex={0}><table className="admin-pin-table">
    <thead><tr><th>Requested</th><th>Amount</th><th>Status</th><th>Reference</th></tr></thead>
    <tbody>{page.items.map(payout=><tr key={payout.id}>
     <td>{new Date(payout.createdAt).toLocaleDateString('en-IN')}</td>
     <td>{money(payout.amountPaise)}</td>
     <td>{payout.status==='REQUESTED'?'Pending':payout.status==='PAID'?'Paid':'Rejected'}</td>
     <td>{payout.settlementReference??'—'}</td>
    </tr>)}</tbody>
   </table></div>}
  <div className="admin-pin-issued-actions" aria-label="Payout history pagination">
   <button className="button alt" type="button" disabled={pageBusy||history.length===0}
    onClick={previousPage}>Previous page</button>
   <button className="button alt" type="button" disabled={pageBusy||!page?.nextCursor}
    onClick={nextPage}>Next page</button>
  </div>
 </section>;
}
