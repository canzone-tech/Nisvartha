'use client';
import {FormEvent,useCallback,useEffect,useState} from 'react';
type Role='ADMIN'|'EDITOR'|'APPROVER'|'AUDITOR';
type Media={id:string;title:string;altText:string;caption:string|null;status:'DRAFT'|'SUBMITTED'|'APPROVED'|'REJECTED'|'ARCHIVED';uploaderId:string;reviewReason:string|null;createdAt:string;width:number;height:number};
export function AdminMediaPanel({user}:{user:{id:string;role:Role}}){
 const [rows,setRows]=useState<Media[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [file,setFile]=useState<File|null>(null),[title,setTitle]=useState(''),[altText,setAltText]=useState(''),[caption,setCaption]=useState('');
 const [rights,setRights]=useState(false),[consent,setConsent]=useState(false),[reason,setReason]=useState('');
 const canUpload=user.role==='EDITOR'||user.role==='ADMIN';
 const canReview=user.role==='APPROVER'||user.role==='ADMIN';
 const reload=useCallback(async()=>{
  const response=await fetch('/api/admin/backend/cms/media',{cache:'no-store'});
  if(!response.ok)throw Error('Unable to load media library');
  setRows(await response.json() as Media[]);
 },[]);
 useEffect(()=>{void Promise.resolve().then(reload).catch(e=>setError(e instanceof Error?e.message:'Failed to load gallery'))},[reload]);
 async function mutate(id:string,command:'submit'|'approve'|'reject'|'archive'){
  setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/admin/backend/cms/media/'+id+'/'+command,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(command==='reject'?{reason}:{})
   });
   const data=await response.json().catch(()=>null);
   if(!response.ok)throw Error(data?.message||'Media review failed');
   setMessage('Media '+command+' recorded');await reload();
  }catch(e){setError(e instanceof Error?e.message:'Media review failed');}
  finally{setBusy(false)}
 }
 async function upload(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  const form=e.currentTarget;
  if(!file)return;
  setBusy(true);setError('');setMessage('');
  try{
   if(file.size>5*1024*1024)throw Error('Choose a picture up to 5 MB');
   const data=new FormData();
   data.append('file',file);data.append('title',title);data.append('altText',altText);
   if(caption)data.append('caption',caption);
   data.append('rightsConfirmed',rights?'true':'false');
   data.append('consentConfirmed',consent?'true':'false');
   const result=await fetch('/api/admin/media/upload',{method:'POST',body:data});
   const body=await result.json().catch(()=>null);
   if(!result.ok)throw Error(Array.isArray(body?.message)?body.message.join(', '):body?.message||'Upload failed');
   setFile(null);setTitle('');setAltText('');setCaption('');setRights(false);setConsent(false);
   setMessage('Image uploaded privately. Submit it for separate approval.');
   form.reset();
   await reload();
  }catch(err){setError(err instanceof Error?err.message:'Upload failed');}
  finally{setBusy(false)}
 }
 return <section className="admin-panel">
  <h2>Media library & gallery</h2>
  <p>Images are stored on the Foundation server, not S3. Originals are virus-scanned and re-encoded; nothing enters the public gallery before independent approval.</p>
  {message&&<p role="status" className="admin-success">{message}</p>}
  {error&&<p role="alert" className="admin-error">{error}</p>}
  {canUpload&&<form className="admin-form admin-media-form" onSubmit={upload}>
   <label>Image (JPEG, PNG or WebP, maximum 5 MB)
    <input type="file" accept="image/jpeg,image/png,image/webp" required onChange={e=>setFile(e.target.files?.[0]||null)}/>
   </label>
   <label>Media title <input value={title} minLength={3} maxLength={160} required onChange={e=>setTitle(e.target.value)}/></label>
   <label>Accessible description (alt text) <input value={altText} minLength={4} maxLength={300} required onChange={e=>setAltText(e.target.value)}/></label>
   <label>Caption (optional) <textarea value={caption} maxLength={500} onChange={e=>setCaption(e.target.value)}/></label>
   <label className="media-consent"><input type="checkbox" checked={rights} onChange={e=>setRights(e.target.checked)} required/> I confirm the Foundation has rights to publish this image.</label>
   <label className="media-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required/> I confirm participant consent and applicable privacy clearance.</label>
   <button className="button" type="submit" disabled={busy||!file||!rights||!consent}>Upload privately</button>
  </form>}
  <h3>Editorial review queue</h3>
  {rows.length===0?<p>No images uploaded yet.</p>:<div className="cms-list">{rows.map(media=><article className="cms-row" key={media.id}>
   <div><strong>{media.title}</strong><p>{media.altText}</p><p>{media.width}×{media.height} · {media.status}</p>
    {media.reviewReason&&<p>Review reason: {media.reviewReason}</p>}
    {media.status==='APPROVED'&&<p><a href={'/api/media/'+media.id} target="_blank" rel="noopener noreferrer">View approved image</a></p>}
   </div>
   <div className="cms-row-actions">
    {canUpload&&media.uploaderId===user.id&&['DRAFT','REJECTED'].includes(media.status)&&<button disabled={busy} onClick={()=>void mutate(media.id,'submit')}>Submit</button>}
    {canReview&&media.uploaderId!==user.id&&media.status==='SUBMITTED'&&<button disabled={busy} onClick={()=>void mutate(media.id,'approve')}>Approve</button>}
    {canReview&&media.uploaderId!==user.id&&media.status==='SUBMITTED'&&<button disabled={busy||reason.trim().length<8} onClick={()=>void mutate(media.id,'reject')}>Reject</button>}
    {canReview&&media.status!=='ARCHIVED'&&<button disabled={busy} onClick={()=>void mutate(media.id,'archive')}>Archive</button>}
   </div>
  </article>)}</div>}
  {canReview&&<label className="admin-reason">Rejection reason (minimum 8 characters)<textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={1000}/></label>}
 </section>;
}
