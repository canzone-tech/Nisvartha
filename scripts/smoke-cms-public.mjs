import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const argon2=require('argon2');
const sharp=require('sharp');
const db=new PrismaClient();
const staffIds=[randomUUID(),randomUUID()];
const slug='ci-cms-proj-'+randomUUID();
const email=staffIds.map(x=>'cross-'+x.slice(0,8)+'@example.invalid');
const password='Synthetic-Test-Password-2026';
const allocate=()=>new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const a=s.address();if(!a||typeof a==='string')return reject(Error('No port'));s.close(()=>resolve(a.port));});});
const apiPort=await allocate(),webPort=await allocate();
const api='http://127.0.0.1:'+apiPort+'/api/v1',web='http://127.0.0.1:'+webPort;
let app,site,contentId,eventId,mediaId;
const post=async(path,token,body)=>{
 const response=await fetch(api+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body),cache:'no-store'});
 const raw=await response.text();
 let data;try{data=JSON.parse(raw)}catch{data=raw}
 return {status:response.status,data};
};
const waitReady=async(origin)=>{
 for(let i=0;i<80;i++){
  try{const result=await fetch(origin);if(result.ok)return;}catch{}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 throw new Error('Compiled application not ready '+origin);
};
try{
 const hash=await argon2.hash(password,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
 await db.staffUser.createMany({data:staffIds.map((id,i)=>({id,email:email[i],displayName:'CMS Crossapp Test',role:'ADMIN',passwordHash:hash}))});
 app=spawn(process.execPath,['backend/dist/main.js'],{env:{...process.env,PORT:String(apiPort)},stdio:'ignore',detached:true});
 await waitReady(api+'/health/ready');
 site=spawn('npm',['--prefix','frontend','run','start','--','-p',String(webPort)],{env:{...process.env,CMS_PUBLIC_CONTENT_ENABLED:'true',API_INTERNAL_URL:'http://127.0.0.1:'+apiPort},stdio:'ignore',detached:true});
 await waitReady(web);
 let page=await (await fetch(web+'/projects',{cache:'no-store'})).text();
 assert.ok(!page.includes(slug),'Unpublished project appeared before creation');
 const tokens=[];
 for(const staffEmail of email){
  const response=await fetch(api+'/staff/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:staffEmail,password})});
  assert.equal(response.status,200,'Staff login in crossapp test');
  tokens.push((await response.json()).accessToken);
 }
 const browserLogin=await fetch(web+'/api/admin/session/login',{
  method:'POST',headers:{Origin:web,'Content-Type':'application/json'},
  body:JSON.stringify({email:email[0],password}),
 });
 assert.equal(browserLogin.status,200,'HttpOnly staff session login failed: '+browserLogin.status+' '+(await browserLogin.clone().text()).slice(0,180));
 const setCookie=browserLogin.headers.get('set-cookie')||'';
 assert.match(setCookie,/nisvartha_staff_access=/);
 assert.match(setCookie,/httponly/i);
 assert.match(setCookie,/samesite=strict/i);
 const browserCookie=setCookie.split(';')[0];
 const panel=await fetch(web+'/admin',{headers:{Cookie:browserCookie}});
 assert.equal(panel.status,200,'Authenticated staff workspace failed');
 assert.ok((await panel.text()).includes('Member operations at a glance'));
 const staffProxy=await fetch(web+'/api/admin/backend/staff/me',{headers:{Cookie:browserCookie}});
 assert.equal(staffProxy.status,200,'Server proxy failed to authenticate staff');
 const forged=await fetch(web+'/api/admin/backend/cms/contents',{
  method:'POST',headers:{Cookie:browserCookie,Origin:'https://cross-origin.invalid','Content-Type':'application/json'},body:'{}',
 });
 assert.equal(forged.status,403,'Cookie-authenticated write must reject cross-origin CSRF');
 const created=await post('/cms/contents',tokens[0],{slug,kind:'PROJECT',title:'Verified cross-app project',summary:'Published summary',body:'This published information is checked in CI. <script>globalThis.__nisvarthaInjected=true</script>'});
 assert.equal(created.status,201,'CMS creation failed');contentId=created.data.content.id;
 const revisionId=created.data.revision.id;
 const anonymousPreview=await fetch(web+'/admin/preview/'+revisionId,{redirect:'manual'});
 assert.equal(anonymousPreview.status,307,'Preview must not open without staff session');
 assert.equal(anonymousPreview.headers.get('location'),'/admin/login');
 const previewRes=await fetch(web+'/admin/preview/'+revisionId,{headers:{Cookie:browserCookie},cache:'no-store'});
 assert.equal(previewRes.status,200,'Staff-only preview SSR unavailable');
 const previewHtml=await previewRes.text();
 assert.ok(previewHtml.includes('Internal preview'),'Missing explicit draft warning');
 assert.ok(previewHtml.includes('Verified cross-app project'),'Stored preview title missing');
 assert.ok(previewHtml.includes('noindex'),'Private preview must not be indexed');
 assert.ok(!previewHtml.includes('<script>globalThis.__nisvarthaInjected=true</script>'),
  'Unescaped editor-provided HTML escaped from preview');
 assert.ok(previewHtml.includes('&lt;script&gt;'),'React must escape editor body as plain text');
 assert.equal((await fetch(api+'/cms/revisions/'+revisionId+'/preview')).status,401,
  'API preview cannot be read anonymously');
 assert.equal((await fetch(web+'/projects/'+slug,{redirect:'manual'})).status,404,
  'Draft preview must not expose public page');

 assert.equal((await post('/cms/revisions/'+created.data.revision.id+'/submit',tokens[0],{})).status,201);
 assert.equal((await post('/cms/revisions/'+created.data.revision.id+'/approve',tokens[0],{})).status,201);
 const list=await fetch(web+'/projects',{cache:'no-store'});assert.equal(list.status,200);
 page=await list.text();assert.ok(page.includes('Verified cross-app project'),'CMS publication not reflected in Next.js');
 const detail=await fetch(web+'/projects/'+slug,{cache:'no-store'});assert.equal(detail.status,200,'CMS project detail unavailable');
 assert.ok((await detail.text()).includes('This published information is checked in CI.'));
 const approvedPreview=await fetch(web+'/admin/preview/'+revisionId,{headers:{Cookie:browserCookie}});
 assert.equal(approvedPreview.status,200,'Approved revision should remain previewable to staff');
 assert.ok((await approvedPreview.text()).includes('Currently published'));
 assert.equal((await post('/cms/contents/'+contentId+'/archive',tokens[0],{})).status,201);
 const archived=await fetch(web+'/projects/'+slug,{cache:'no-store'});
 assert.equal(archived.status,404,'CMS archived project remained publicly visible');
 const historicalPreview=await fetch(web+'/admin/preview/'+revisionId,{headers:{Cookie:browserCookie}});
 assert.equal(historicalPreview.status,200,'Archived revision history unavailable to authorized staff');
 assert.ok((await historicalPreview.text()).includes('Archived'));


 // FR-022: approved event scheduling must render in the actual Next.js release.
 const eventSlug='ci-public-event-'+randomUUID();
 const event=await post('/cms/contents',tokens[0],{
  slug:eventSlug,kind:'EVENT',title:'CI-approved open community event',summary:'Synthetic event listing',
  body:'Event body for staging testing only.',
  eventStartAt:'2026-11-15T10:00:00+05:30',
  eventEndAt:'2026-11-15T12:00:00+05:30',
  eventTimezone:'Asia/Kolkata',
  eventVenue:'Community Hall',
  eventRegistrationUrl:'https://example.org/events/registration',
  eventLifecycle:'SCHEDULED'
 });
 assert.equal(event.status,201,'Valid event rejected by compiled API: '+JSON.stringify(event.data));
 eventId=event.data.content.id;
 let eventsHtml=await (await fetch(web+'/news-events',{cache:'no-store'})).text();
 assert.ok(!eventsHtml.includes('CI-approved open community event'),'Event draft exposed to public before review');
 assert.equal((await post('/cms/revisions/'+event.data.revision.id+'/submit',tokens[0],{})).status,201);
 assert.equal((await post('/cms/revisions/'+event.data.revision.id+'/approve',tokens[0],{})).status,201);
 eventsHtml=await (await fetch(web+'/news-events',{cache:'no-store'})).text();
 assert.ok(eventsHtml.includes('CI-approved open community event'),'Approved event missing from public Next.js page');
 assert.ok(eventsHtml.includes('Community Hall'),'Approved venue missing');
 assert.ok(eventsHtml.includes('Asia/Kolkata'),'Approved timezone missing');
 assert.ok(eventsHtml.includes('registration'),'Verified HTTPS registration link missing');
 assert.equal((await post('/cms/contents/'+eventId+'/archive',tokens[0],{})).status,201);
 eventsHtml=await (await fetch(web+'/news-events',{cache:'no-store'})).text();
 assert.ok(!eventsHtml.includes('CI-approved open community event'),'Archived event remained published');
 console.log('Nisvartha approved event → Next.js schedule/timezone/venue and archive: PASS');

 // FR-021/023: approved local gallery must survive Next.js proxy boundaries.
 const bytes=await sharp({create:{width:12,height:12,channels:3,background:'#347852'}}).png().toBuffer();
 const form=new FormData();
 form.append('file',new Blob([bytes],{type:'image/png'}),'original-ci-photo.png');
 form.append('title','Approved synthetic image gallery');
 form.append('altText','An entirely synthetic image for Nisvartha CI');
 form.append('caption','No real subjects or beneficiary identities');
 form.append('rightsConfirmed','true');
 form.append('consentConfirmed','true');
 form.append('rightsEvidenceRef','RIGHTS-CI-CROSSAPP-0001');
 form.append('consentEvidenceRef','CONSENT-CI-CROSSAPP-0001');
 const uploadResponse=await fetch(api+'/cms/media/upload',{
  method:'POST',headers:{Authorization:'Bearer '+tokens[0]},body:form
 });
 assert.equal(uploadResponse.status,201,'Private gallery upload rejected: '+(await uploadResponse.clone().text()).slice(0,180));
 const media=await uploadResponse.json();mediaId=media.id;
 let galleryPage=await (await fetch(web+'/gallery',{cache:'no-store'})).text();
 assert.ok(!galleryPage.includes('Approved synthetic image gallery'),'Draft image was publicly listed');
 assert.equal((await fetch(web+'/api/media/'+mediaId)).status,404,'Image bytes escaped prior to review');
 assert.equal((await post('/cms/media/'+mediaId+'/submit',tokens[0],{})).status,201);
 assert.equal((await post('/cms/media/'+mediaId+'/approve',tokens[0],{})).status,201);
 galleryPage=await (await fetch(web+'/gallery',{cache:'no-store'})).text();
 assert.ok(galleryPage.includes('Approved synthetic image gallery'),'Approved image absent from Next.js gallery');
 const publicImage=await fetch(web+'/api/media/'+mediaId);
 assert.equal(publicImage.status,200,'Next.js did not serve approved image');
 const processed=Buffer.from(await publicImage.arrayBuffer());
 assert.equal(processed.toString('ascii',0,4),'RIFF');
 assert.equal(processed.toString('ascii',8,12),'WEBP');
 assert.equal((await post('/cms/media/'+mediaId+'/archive',tokens[0],{})).status,201);
 assert.equal((await fetch(web+'/api/media/'+mediaId)).status,404,'Archived image still accessible through Next.js');
 galleryPage=await (await fetch(web+'/gallery',{cache:'no-store'})).text();
 assert.ok(!galleryPage.includes('Approved synthetic image gallery'),'Archived image still listed');
 console.log('Nisvartha private local gallery → approved Next.js image → archive: PASS');
 console.log('Nisvartha CMS→Next.js approved-only integration, archive and runtime rendering: PASS');
}finally{
 for(const child of [site,app])if(child?.pid){try{process.kill(-child.pid,'SIGTERM')}catch{}await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,3000))]);}
 if(contentId){await db.cmsRevision.deleteMany({where:{contentId}});await db.cmsContent.deleteMany({where:{id:contentId}});}
 if(eventId){await db.cmsRevision.deleteMany({where:{contentId:eventId}});await db.cmsContent.deleteMany({where:{id:eventId}});}
 if(mediaId){
  await db.cmsMedia.deleteMany({where:{id:mediaId}});
  if(process.env.MEDIA_STORAGE_ROOT)await (await import('node:fs/promises')).rm(
   (await import('node:path')).join(process.env.MEDIA_STORAGE_ROOT,'objects',mediaId+'.webp'),
   {force:true}
  ).catch(()=>{});
 }
 await db.staffSession.deleteMany({where:{staffId:{in:staffIds}}});
 await db.cmsAudit.deleteMany({where:{actorId:{in:staffIds}}});
 await db.staffUser.deleteMany({where:{id:{in:staffIds}}});
 await db.$disconnect();
}
