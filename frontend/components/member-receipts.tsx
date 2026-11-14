'use client';
import {useState} from 'react';

export type RegistrationReceipt={
 number:string;memberId:string;memberName:string;amountPaise:number;
 receivedAt:string;issuedAt:string;isOwn:boolean
};
export type RegistrationReceiptPage={items:RegistrationReceipt[];nextCursor:string|null};
const formatInr=(amountPaise:number)=>'₹'+(amountPaise/100).toLocaleString('en-IN',{
 minimumFractionDigits:2,maximumFractionDigits:2
});
export function MemberReceipts({initial}:{initial:RegistrationReceiptPage}){
 const [data,setData]=useState(initial),[history,setHistory]=useState<(string|null)[]>([]);
 const [cursor,setCursor]=useState<string|null>(null);
 const [selected,setSelected]=useState<RegistrationReceipt|null>(
  initial.items.find(item=>item.isOwn)??null
 );
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(next:string|null,back:boolean){
  if(busy)return;
  setBusy(true);setError('');
  try{
   const url='/api/member/receipts'+(next?'?cursor='+encodeURIComponent(next):'');
   const response=await fetch(url,{cache:'no-store'});
   const parsed=await response.json().catch(()=>null) as RegistrationReceiptPage|null;
   if(!response.ok||!parsed||!Array.isArray(parsed.items)||parsed.items.length>25||
     (parsed.nextCursor!==null&&typeof parsed.nextCursor!=='string'))
    throw Error('Unable to load authorized registration receipts');
   setHistory(before=>back?before.slice(0,-1):[...before,cursor]);
   setCursor(next);setData(parsed);
   setSelected(parsed.items.find(item=>item.isOwn)??null);
  }catch(cause){setError(cause instanceof Error?cause.message:'Receipt list unavailable')}
  finally{setBusy(false)}
 }
 return <section className="admin-panel" aria-label="Membership registration receipts">
  <h2>Verified registration receipts</h2>
  <p>Receipts appear only after verified ₹15,000 membership payment. Your own and
   authorized referral-team receipts are shown. These are not donation receipts.</p>
  {error&&<p role="alert" className="admin-error">{error}</p>}
  {!data.items.length?<p>No verified registration receipt available yet.</p>:
   <div className="table-scroll" role="region" tabIndex={0} aria-label="Registration receipt list">
    <table className="admin-pin-table"><thead><tr>
     <th scope="col">Receipt</th><th scope="col">Member</th>
     <th scope="col">Amount</th><th scope="col">Received</th><th scope="col">View</th>
    </tr></thead>
    <tbody>{data.items.map(item=><tr key={item.number}>
     <td><code>{item.number}</code>{item.isOwn?' · Yours':''}</td>
     <td>{item.memberName}</td>
     <td>{formatInr(item.amountPaise)}</td>
     <td>{new Date(item.receivedAt).toLocaleDateString('en-IN')}</td>
     <td><button type="button" disabled={busy}
      onClick={()=>setSelected(item)}>View receipt</button></td>
    </tr>)}</tbody></table>
   </div>}
  <nav className="cms-row-actions" aria-label="Receipt pagination">
   <button type="button" disabled={busy||!history.length}
    onClick={()=>void load(history[history.length-1],true)}>Previous</button>
   <span>Page {history.length+1}</span>
   <button type="button" disabled={busy||!data.nextCursor}
    onClick={()=>void load(data.nextCursor,false)}>Next</button>
  </nav>
  {selected&&<div className="admin-policy">
   <div className="cms-row-actions">
    <button type="button" onClick={()=>window.print()}>Print / Save PDF</button>
    <button type="button" onClick={()=>setSelected(null)}>Close receipt</button>
   </div>
   <article className="member-receipt-print" aria-label="Verified membership fee receipt">
    <div className="member-receipt-brand">
     <p>SERVICE TO HUMANITY</p>
     <h2>NISVARTHA FOUNDATION (R)</h2>
     <strong>REGISTRATION NUMBER: BSK-4-00507-2024</strong>
     <p>Raghuvanahalli Gate, Opp. Udupi Boys Hostel,
      Kanakapura Road, Bengaluru – 560062</p>
     <p>Contact: 6360719137</p>
    </div>
    <h3>MEMBERSHIP REGISTRATION RECEIPT</h3>
    <p className="member-receipt-pair"><span>Receipt No.: <strong>{selected.number}</strong></span>
     <span>Date: <strong>{new Date(selected.receivedAt).toLocaleDateString('en-IN')}</strong></span></p>
    <dl><dt>Member name</dt><dd>{selected.memberName}</dd>
     <dt>Membership fee</dt><dd>{formatInr(selected.amountPaise)}</dd></dl>
    <p>Verified membership registration payment. Not a donation or tax-deduction certificate.</p>
    <p className="member-receipt-signature">Authorized signatory: __________________</p>
    <p className="member-receipt-thanks">Thank you for your valuable contribution!</p>
   </article>
  </div>}
 </section>;
}
