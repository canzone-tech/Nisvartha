'use client';
import {FormEvent,useRef,useState} from 'react';
import Link from 'next/link';
import {chooseEnquirySubmission,type PendingEnquirySubmission} from '@/lib/enquiry-submission';

export function EnquiryForm({kind}:{kind:'contact'|'volunteer'}){
 const [reference,setReference]=useState('');
 const [error,setError]=useState('');
 const [sending,setSending]=useState(false);
 const inFlight=useRef(false);
 const pending=useRef<PendingEnquirySubmission|null>(null);
 if(process.env.NEXT_PUBLIC_FORMS_ENABLED!=='true'||process.env.NEXT_PUBLIC_PRIVACY_APPROVED!=='true')
  return <p role="status">Enquiries will open after the official privacy notice and operational review are approved.</p>;

 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(inFlight.current)return;
  const data=new FormData(event.currentTarget);
  const fields={
   name:String(data.get('name')??''),
   email:String(data.get('email')??''),
   phone:String(data.get('phone')??'')||undefined,
   subject:String(data.get('subject')??''),
   message:String(data.get('message')??''),
   interests:String(data.get('interests')??'')||undefined,
   availability:String(data.get('availability')??'')||undefined,
   consent:data.get('consent')==='on',
   website:String(data.get('website')??'')
  };
  pending.current=chooseEnquirySubmission(fields,pending.current,()=>crypto.randomUUID());
  const body={submissionId:pending.current.submissionId,...fields};
  inFlight.current=true;
  setError('');
  setSending(true);
  try{
   const response=await fetch((process.env.NEXT_PUBLIC_API_URL||'http://127.0.0.1:3100')+
    '/api/v1/enquiries/'+kind,{
     method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
    });
   if(!response.ok)throw new Error('The enquiry could not be submitted. Please check your details and try again.');
   const result=await response.json() as {reference:string};
   if(!result.reference)throw new Error('The confirmation could not be read. Please try again.');
   setReference(result.reference);
  }catch(e){
   setError(e instanceof Error?e.message:'Unable to submit your enquiry. Please try again.');
  }finally{
   inFlight.current=false;
   setSending(false);
  }
 }

 if(reference)return <section className="enquiry-confirmation" role="status">
  <h2>Enquiry received</h2>
  <p>Thank you. Your enquiry reference is <strong>{reference}</strong>.</p>
  <p>Please keep this reference for follow-up.</p>
 </section>;

 return <div className="enquiry-workspace">
  <div className="enquiry-workspace-heading">
   <h2>{kind==='contact'?'Send an enquiry':'Volunteer enquiry'}</h2>
   <p>Complete the form below and we’ll confirm your submission with a reference number.</p>
  </div>
  <form onSubmit={submit} className="enquiry-form card form" aria-label={kind==='contact'?'Contact enquiry':'Volunteer enquiry'}>
   <div className="enquiry-form-fields">
    <label>Full name
     <input name="name" autoComplete="name" required minLength={2} maxLength={120}/>
    </label>
    <label>Email address
     <input name="email" type="email" autoComplete="email" required maxLength={254}/>
    </label>
    <label>Phone (optional)
     <input name="phone" type="tel" autoComplete="tel" inputMode="tel" pattern="[0-9+() -]{7,20}" maxLength={20}
      placeholder="Phone number"/>
    </label>
    <label>Subject
     <input name="subject" required minLength={2} maxLength={160}
      defaultValue={kind==='volunteer'?'Volunteer enquiry':''}/>
    </label>
    {kind==='volunteer'&&<>
     <label>Areas of interest
      <input name="interests" required minLength={2} maxLength={300}/>
     </label>
     <label>Availability
      <input name="availability" required minLength={2} maxLength={300}/>
     </label>
    </>}
    <label className="enquiry-wide">Message
     <textarea name="message" required minLength={10} maxLength={3000} rows={5}/>
    </label>
   </div>
   <div className="trap" aria-hidden="true"><label>Website <input name="website" tabIndex={-1} autoComplete="off"/></label></div>
   <label className="consent">
    <input type="checkbox" name="consent" required/>
    <span>I agree to be contacted about this enquiry under the <Link href="/privacy-policy">privacy notice</Link>.</span>
   </label>
   {error&&<p className="enquiry-error" role="alert">{error}</p>}
   <div className="enquiry-actions">
    <button disabled={sending} aria-busy={sending} type="submit">{sending?'Submitting…':'Send enquiry'}</button>
   </div>
  </form>
 </div>;
}
