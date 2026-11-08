'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {MemberEarnings} from './member-earnings';
import type {MemberEarningsView} from './member-earnings';

export function AdminMemberEarnings({memberId}:{memberId:string}){
 const [data,setData]=useState<MemberEarningsView|null>(null);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [reference,setReference]=useState(''),[evidence,setEvidence]=useState('');
 const [settledAt,setSettledAt]=useState('');
 const keys=useRef(new Map<string,string>());
 const load=useCallback(async()=>{
  setError('');
  const response=await fetch('/api/admin/backend/cms/membership/earnings/'+encodeURIComponent(memberId),{cache:'no-store'});
  const body=await response.json().catch(()=>null);
  if(!response.ok)throw Error(body?.message||'Unable to load member earnings');
  setData(body as MemberEarningsView);
 },[memberId]);
 useEffect(()=>{void Promise.resolve().then(()=>load()).catch(e=>setError(e instanceof Error?e.message:'Unable to load member earnings'))},[load]);
 async function settle(id:string){
  const when=new Date(settledAt);
  if(!reference.trim()||!evidence.trim()||!Number.isFinite(when.getTime())){
   setError('Settlement reference, evidence and date/time are required');return;
  }
  setBusy(true);setError('');setNotice('');
  try{
   const requestKey=keys.current.get(id)??crypto.randomUUID();keys.current.set(id,requestKey);
   const response=await fetch('/api/admin/backend/cms/membership/earnings/'+encodeURIComponent(id)+'/settle',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
     requestKey,settlementReference:reference.trim(),evidenceRef:evidence.trim().toUpperCase(),
     settledAt:when.toISOString()
    })
   });
   const body=await response.json().catch(()=>null);
   if(!response.ok)throw Error(body?.message||'Settlement rejected');
   keys.current.delete(id);setReference('');setEvidence('');setSettledAt('');
   setNotice('Offline settlement recorded');await load();
  }catch(e){setError(e instanceof Error?e.message:'Settlement failed')}
  finally{setBusy(false)}
 }
 return <div className="admin-policy">
  {error&&<p role="alert" className="admin-error">{error}</p>}
  {notice&&<p role="status" className="admin-success">{notice}</p>}
  {data&&<>
   <MemberEarnings data={data}/>
   {data.earnings.some(x=>x.status==='EARNED')&&<section className="admin-panel">
    <h3>Record offline settlement</h3>
    <p>Use the bank/UPI/cash settlement reference after the payment has actually been made.</p>
    <div className="admin-form">
     <label>Settlement reference<input value={reference} maxLength={80}
      onChange={e=>setReference(e.target.value)}/></label>
     <label>Evidence reference<input value={evidence} maxLength={120}
      onChange={e=>setEvidence(e.target.value.toUpperCase())}/></label>
     <label>Settlement date/time<input type="datetime-local" value={settledAt}
      onChange={e=>setSettledAt(e.target.value)}/></label>
    </div>
    <div className="cms-list">{data.earnings.filter(x=>x.status==='EARNED').map(row=>
     <div className="cms-row" key={row.id}><div><strong>{row.kind.replaceAll('_',' ')}</strong>
      <p>₹{(row.amountPaise/100).toLocaleString('en-IN')}</p></div>
      <button type="button" disabled={busy} onClick={()=>void settle(row.id)}>Mark settled</button>
     </div>)}</div>
   </section>}
  </>}
 </div>;
}
