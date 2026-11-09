'use client';
import {FormEvent,useState} from 'react';
import Link from 'next/link';
export function EnquiryForm({kind}:{kind:'contact'|'volunteer'}){
 const [reference,setReference]=useState('');
 const [error,setError]=useState('');
 const [sending,setSending]=useState(false);
 const [submissionId,setSubmissionId]=useState('');
 if(process.env.NEXT_PUBLIC_FORMS_ENABLED!=='true'||process.env.NEXT_PUBLIC_PRIVACY_APPROVED!=='true')return <p role="status">Enquiries will open after the official privacy notice and operational review are approved.</p>;
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setError('');setSending(true);
  const form=event.currentTarget;const data=new FormData(form);
  const id=submissionId||crypto.randomUUID();setSubmissionId(id);
  const body={submissionId:id,name:data.get('name'),email:data.get('email'),phone:data.get('phone')||undefined,subject:data.get('subject'),message:data.get('message'),interests:data.get('interests')||undefined,availability:data.get('availability')||undefined,consent:data.get('consent')==='on',website:data.get('website')||''};
  try{
   const response=await fetch((process.env.NEXT_PUBLIC_API_URL||'http://127.0.0.1:3100')+'/api/v1/enquiries/'+kind,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   if(!response.ok)throw new Error('The request could not be submitted. Please try again.');
   const result=await response.json() as {reference:string};setReference(result.reference);
  }catch(e){setError(e instanceof Error?e.message:'Unable to submit');}finally{setSending(false)}
 }
 if(reference)return <p role="status">Thank you. Your enquiry reference is <strong>{reference}</strong>.</p>;
 return <form onSubmit={submit} className="enquiry-form card form">
  <label>Name <input name="name" required minLength={2} maxLength={120}/></label>
  <label>Email <input name="email" type="email" required maxLength={254}/></label>
  <label>Phone <input name="phone" inputMode="tel" pattern="[0-9+() -]{7,20}" maxLength={20}
   placeholder="Enter phone number"/></label>
  <label>Subject <input name="subject" required minLength={2} maxLength={160} defaultValue={kind==='volunteer'?'Volunteer enquiry':''}/></label>
  <label>Message <textarea name="message" required minLength={10} maxLength={3000}/></label>
  {kind==='volunteer'&&<><label>Interests <input name="interests" required minLength={2} maxLength={300}/></label><label>Availability <input name="availability" required minLength={2} maxLength={300}/></label></>}
  <div className="trap" aria-hidden="true"><label>Website <input name="website" tabIndex={-1} autoComplete="off"/></label></div>
  <label className="consent"><input type="checkbox" name="consent" required/> I agree to be contacted about this enquiry under the <Link href="/privacy-policy">privacy notice</Link>.</label>
  {error&&<p role="alert">{error}</p>}
  <button disabled={sending} type="submit">{sending?'Submitting…':'Send enquiry'}</button>
 </form>;
}
