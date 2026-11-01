'use client';
import {FormEvent,useEffect,useState} from 'react';

type Applicant={id:string;member:{id:string;email:string;displayName:string;status:string}};
export function AdminMemberRecoveryPanel(){
 const [items,setItems]=useState<Applicant[]>([]);
 const [memberId,setMemberId]=useState(''),[evidence,setEvidence]=useState(''),[verified,setVerified]=useState(false);
 const [code,setCode]=useState(''),[expires,setExpires]=useState('');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{void Promise.resolve().then(async()=>{
  const response=await fetch('/api/admin/backend/cms/membership/applications',{cache:'no-store'});
  if(!response.ok)throw Error('Cannot load member accounts');
  setItems(await response.json() as Applicant[]);
 }).catch(e=>setError(e instanceof Error?e.message:'Member recovery unavailable'))},[]);
 async function issue(e:FormEvent){
  e.preventDefault();setCode('');setExpires('');setError('');setBusy(true);
  try{
   const result=await fetch('/api/admin/backend/cms/membership/recovery/'+memberId+'/issue',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({identityVerified:verified,identityEvidenceRef:evidence})
   });
   const body=await result.json().catch(()=>null);
   if(!result.ok)throw Error(Array.isArray(body?.message)?body.message.join(', '):body?.message||'Recovery denied');
   if(!body?.code)throw Error('Recovery code unavailable');
   setCode(body.code);setExpires(body.expiresAt);setVerified(false);
  }catch(e){setError(e instanceof Error?e.message:'Recovery denied')}
  finally{setBusy(false)}
 }
 return <section className="admin-panel">
  <h2>Verified member password recovery</h2>
  <p>Admin-only. Confirm account ownership through a separate approved identity process before issuing a one-time code. Never put this code in logs or messages to an unverified contact.</p>
  {error&&<p role="alert" className="admin-error">{error}</p>}
  <form className="admin-form" onSubmit={issue}>
   <label>Member<select required value={memberId} onChange={e=>{setMemberId(e.target.value);setCode('');setExpires('')}}>
    <option value="">Select verified member</option>
    {items.map(a=><option key={a.member.id} value={a.member.id}>{a.member.displayName} ({a.member.email})</option>)}
   </select></label>
   <label>Private identity evidence register ID<input required maxLength={120} minLength={8}
    pattern="[A-Za-z0-9][A-Za-z0-9_-]{7,119}" value={evidence} onChange={e=>setEvidence(e.target.value)}
    placeholder="IDENTITY-2026-00001"/></label>
   <label className="media-consent"><input type="checkbox" required checked={verified} onChange={e=>setVerified(e.target.checked)}/>
    I have independently verified identity and authority to deliver this code.</label>
   <button className="button" disabled={!memberId||!verified||busy}>Issue one-time recovery code</button>
  </form>
  {code&&<div className="review-notice" role="status">
   <h3>One-time code — display once</h3>
   <p><code>{code}</code></p>
   <p>Expires: {expires}. Deliver only to the verified member through the Foundation's approved secure method.</p>
   <button type="button" onClick={()=>{setCode('');setExpires('')}}>Clear code from this screen</button>
  </div>}
 </section>;
}
