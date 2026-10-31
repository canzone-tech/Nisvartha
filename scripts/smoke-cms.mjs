import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const argon2=require('argon2');
const db=new PrismaClient();
const ids=[randomUUID(),randomUUID(),randomUUID()];
const slug='ci-project-'+randomUUID();
const emailIds=ids.map(x=>x.slice(0,8));
const port=await new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const a=s.address();if(!a||typeof a==='string')return reject(Error('No port'));s.close(()=>resolve(a.port));});});
const root='http://127.0.0.1:'+port+'/api/v1';
let child,contentId,revisionId,eventContentId;
const password='Nisvartha-CI-Synthetic-Secret-123';
const headers=token=>({'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})});
async function request(path,method='GET',body,token){
 const response=await fetch(root+path,{method,headers:headers(token),...(body===undefined?{}:{body:JSON.stringify(body)})});
 const text=await response.text();
 let data;try{data=JSON.parse(text)}catch{data=text}
 return {status:response.status,data};
}
try{
 const hash=await argon2.hash(password,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
 await db.staffUser.createMany({data:ids.map((id,i)=>({id,email:'ci-'+emailIds[i]+'@example.invalid',displayName:'Synthetic Staff '+i,role:['EDITOR','APPROVER','AUDITOR'][i],passwordHash:hash}))});
 child=spawn(process.execPath,['backend/dist/main.js'],{env:{...process.env,PORT:String(port)},stdio:'ignore',detached:true});
 let ready=false;
 for(let i=0;i<75;i++){if(child.exitCode!==null)throw Error('Compiled API crashed');try{if((await request('/health/ready')).status===200){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,200));}
 assert.ok(ready,'Compiled API not ready');
 const tokens=[];
 for(let i=0;i<3;i++){
  const login=await request('/staff/login','POST',{email:'ci-'+emailIds[i]+'@example.invalid',password});
  assert.equal(login.status,200,'Staff login failed '+i);
  assert.ok(login.data.accessToken,'Missing session token');
  tokens.push(login.data.accessToken);
 }
 const [editor,approver,auditor]=tokens;
 assert.equal((await request('/cms/contents','POST',{slug,kind:'PROJECT',title:'Approved title',summary:'Approved summary',body:'Evidence-based project body'})).status,401,'Missing auth must be rejected');
 assert.equal((await request('/cms/contents','POST',{slug,kind:'PROJECT',title:'Test',summary:'Test',body:'Test'},auditor)).status,403,'Read-only auditor must not write');
 const created=await request('/cms/contents','POST',{slug,kind:'PROJECT',title:'Approved title',summary:'Approved summary',body:'Evidence-based project body'},editor);
 assert.equal(created.status,201,'Content creation failed: '+JSON.stringify(created.data));
 contentId=created.data.content.id;revisionId=created.data.revision.id;
 assert.equal((await request('/public/content/'+slug)).status,404,'Draft leaked publicly');
 assert.equal((await request('/cms/revisions/'+revisionId+'/submit','POST',{},editor)).status,201);
 assert.equal((await request('/cms/revisions/'+revisionId+'/approve','POST',{},editor)).status,403);
 assert.equal((await request('/cms/revisions/'+revisionId+'/approve','POST',{},approver)).status,201);
 let pub=await request('/public/content/'+slug);
 assert.equal(pub.status,200);assert.equal(pub.data.title,'Approved title');
 const edit=await request('/cms/contents/'+contentId+'/revisions','POST',{title:'Unapproved new title',summary:'New unapproved summary',body:'New material pending review'},editor);
 assert.equal(edit.status,201);const nextId=edit.data.id;
 pub=await request('/public/content/'+slug);
 assert.equal(pub.data.title,'Approved title','Draft must not replace approved copy');
 assert.equal((await request('/cms/revisions/'+nextId+'/submit','POST',{},editor)).status,201);
 assert.equal((await request('/cms/revisions/'+nextId+'/reject','POST',{reason:'Insufficient verification'},approver)).status,201);
 pub=await request('/public/content/'+slug);
 assert.equal(pub.data.title,'Approved title','Rejection must not unpublish previous copy');
 const detail=await request('/cms/contents/'+contentId,'GET',undefined,auditor);
 assert.equal(detail.status,200);assert.equal(detail.data.revisions.length,2);
 const logs=await request('/cms/audit','GET',undefined,auditor);
 assert.equal(logs.status,200);
 assert.ok(logs.data.some(e=>e.action==='CONTENT_PUBLISH'&&e.objectId===contentId));
 assert.equal((await request('/cms/audit','GET',undefined,editor)).status,403);
 // FR-022: event revisions require schedule metadata and independent approval.
 const eventSlug='ci-event-'+randomUUID();
 const schedule={
  eventStartAt:'2026-11-15T10:00:00+05:30',
  eventEndAt:'2026-11-15T12:00:00+05:30',
  eventTimezone:'Asia/Kolkata',eventVenue:'Community Hall',
  eventRegistrationUrl:'https://example.org/events/registration',
  eventLifecycle:'SCHEDULED'
 };
 const baseEvent={slug:eventSlug,kind:'EVENT',title:'Synthetic community event',summary:'Authorized event announcement',body:'Staff-approved event details'};
 assert.equal((await request('/cms/contents','POST',{...baseEvent},editor)).status,400,'Event without schedule accepted');
 assert.equal((await request('/cms/contents','POST',{...baseEvent,...schedule,eventTimezone:'Mars/Olympus'},editor)).status,400,'Invalid IANA timezone accepted');
 assert.equal((await request('/cms/contents','POST',{...baseEvent,...schedule,eventRegistrationUrl:'http://example.org/register'},editor)).status,400,'Non-HTTPS registration accepted');
 assert.equal((await request('/cms/contents','POST',{...baseEvent,...schedule,eventEndAt:'2026-11-15T09:00:00+05:30'},editor)).status,400,'End before start accepted');
 assert.equal((await request('/cms/contents','POST',{...baseEvent,...schedule,eventStartAt:'2026-11-15T10:00:00'},editor)).status,400,'Timezone-less timestamp accepted');
 const createdEvent=await request('/cms/contents','POST',{...baseEvent,...schedule},editor);
 assert.equal(createdEvent.status,201,'Valid event rejected: '+JSON.stringify(createdEvent.data));
 eventContentId=createdEvent.data.content.id;
 const firstEventRevision=createdEvent.data.revision.id;
 assert.equal((await request('/public/content/'+eventSlug)).status,404,'Unreviewed event became public');
 assert.equal((await request('/cms/revisions/'+firstEventRevision+'/submit','POST',{},editor)).status,201);
 assert.equal((await request('/cms/revisions/'+firstEventRevision+'/approve','POST',{},approver)).status,201);
 let eventPub=await request('/public/content/'+eventSlug);
 assert.equal(eventPub.status,200);
 assert.equal(eventPub.data.eventTimezone,'Asia/Kolkata');
 assert.equal(eventPub.data.eventLifecycle,'SCHEDULED');
 const publicEvents=await request('/public/content?kind=EVENT');
 assert.equal(publicEvents.status,200);
 assert.ok(publicEvents.data.some(row=>row.slug===eventSlug&&row.eventVenue==='Community Hall'));
 const newEventDraft=await request('/cms/contents/'+eventContentId+'/revisions','POST',{
  title:'Event cancelled',summary:'Community event has been cancelled',body:'Staff-approved cancellation notice',
  ...schedule,eventLifecycle:'CANCELLED'
 },editor);
 assert.equal(newEventDraft.status,201,'Event update failed');
 eventPub=await request('/public/content/'+eventSlug);
 assert.equal(eventPub.data.eventLifecycle,'SCHEDULED','Unapproved cancellation changed published event');
 assert.equal((await request('/cms/revisions/'+newEventDraft.data.id+'/submit','POST',{},editor)).status,201);
 assert.equal((await request('/cms/revisions/'+newEventDraft.data.id+'/approve','POST',{},approver)).status,201);
 eventPub=await request('/public/content/'+eventSlug);
 assert.equal(eventPub.data.eventLifecycle,'CANCELLED','Approved cancellation missing publicly');
 assert.equal((await request('/cms/contents/'+eventContentId+'/archive','POST',{},approver)).status,201);
 assert.equal((await request('/public/content/'+eventSlug)).status,404,'Archived event exposed');
 console.log('Nisvartha FR-022 event dates, timezone, HTTPS links, revision approvals and cancellation: PASS');
 assert.equal((await request('/staff/logout','POST',{},editor)).status,200);
 assert.equal((await request('/staff/me','GET',undefined,editor)).status,401,'Revoked token still active');
 assert.equal((await request('/cms/contents/'+contentId+'/archive','POST',{},approver)).status,201);
 assert.equal((await request('/public/content/'+slug)).status,404,'Archived content still public');

 console.log('Nisvartha staff RBAC, login/session revocation, CMS approval snapshots, archive and audit: PASS');
}finally{
 if(child?.pid){try{process.kill(-child.pid,'SIGTERM')}catch{}await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(r,2500))]);}
 if(contentId){await db.cmsRevision.deleteMany({where:{contentId}});await db.cmsContent.deleteMany({where:{id:contentId}});}
 if(eventContentId){await db.cmsRevision.deleteMany({where:{contentId:eventContentId}});await db.cmsContent.deleteMany({where:{id:eventContentId}});}
 await db.staffSession.deleteMany({where:{staffId:{in:ids}}});
 await db.cmsAudit.deleteMany({where:{actorId:{in:ids}}});
 await db.staffUser.deleteMany({where:{id:{in:ids}}});
 await db.$disconnect();
}
