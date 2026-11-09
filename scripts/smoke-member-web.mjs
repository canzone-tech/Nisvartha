import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const db=new (require('@prisma/client').PrismaClient)();
const argon2=require('argon2');
if(!process.env.DATABASE_URL||new URL(process.env.DATABASE_URL).pathname!=='/nisvartha_ci')
 throw Error('Refuse member web UAT outside isolated DB');
const alloc=()=>new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const a=s.address();if(!a||typeof a==='string')return reject(Error('No port'));s.close(()=>resolve(a.port));});});
const apiPort=await alloc(),webPort=await alloc();
const api='http://127.0.0.1:'+apiPort+'/api/v1',web='http://127.0.0.1:'+webPort;
const staffId=randomUUID(),email='webmember-'+randomUUID().slice(0,8)+'@example.invalid';
const password='Web-Member-CI-Password-2026',staffPassword='CI-Staff-Review-Password-2026';
let backend,frontend,memberId,applicationId,assistedMemberId,assistedApplicationId;
const env={...process.env,MEMBER_RECOVERY_ENABLED:'true',MEMBER_PORTAL_ENABLED:'true',MEMBER_APPLICATIONS_ENABLED:'true',
 MEMBER_STAFF_REGISTRATION_ENABLED:'true',MEMBER_TERMS_VERSION:'ci-terms',MEMBER_PRIVACY_VERSION:'ci-privacy'};
const post=async(path,body,cookie)=>fetch(web+path,{method:'POST',headers:{
 Origin:web,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})
},body:JSON.stringify(body)});
const ready=async(path)=>{
 for(let i=0;i<80;i++){try{const res=await fetch(path);if(res.ok)return}catch{}await new Promise(resolve=>setTimeout(resolve,200))}
 throw Error('Compiled application not ready: '+path);
};
try{
 const hash=await argon2.hash(staffPassword,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
 await db.staffUser.create({data:{id:staffId,email:'uat-'+staffId.slice(0,8)+'@example.invalid',displayName:'UAT member admin',role:'ADMIN',passwordHash:hash}});
 backend=spawn(process.execPath,['backend/dist/main.js'],{env:{...env,PORT:String(apiPort)},stdio:'ignore',detached:true});
 await ready(api+'/health/ready');
 frontend=spawn('npm',['--prefix','frontend','run','start','--','-p',String(webPort)],{
  env:{...env,API_INTERNAL_URL:'http://127.0.0.1:'+apiPort},stdio:'ignore',detached:true
 });
 await ready(web);
 assert.equal((await fetch(web+'/member/register')).status,200,'Member registration page unavailable');
 assert.equal((await fetch(web+'/member/login')).status,200,'Member login page unavailable');
 assert.equal((await fetch(web+'/member/recover')).status,200,'Gated recovery page missing');
 assert.equal((await fetch(web+'/member',{redirect:'manual'})).status,307,'Member dashboard exposed anonymously');
 const denied=await fetch(web+'/api/member/session/register',{method:'POST',headers:{Origin:'https://attacker.invalid','Content-Type':'application/json'},body:'{}'});
 assert.equal(denied.status,403,'Cross-site member registration should fail');
 const register=await post('/api/member/session/register',{email,displayName:'Synthetic Member Browser',password,
  termsVersion:'ci-terms',privacyVersion:'ci-privacy',communicationOptIn:false,consent:true});
 assert.equal(register.status,201,'Member registration failed '+(await register.clone().text()).slice(0,180));
 const created=await register.json();memberId=created.id;applicationId=created.applicationReference;
 const login=await post('/api/member/session/login',{email,password});
 assert.equal(login.status,200,'Member login proxy failed');
 const setCookie=login.headers.get('set-cookie')||'';
 assert.match(setCookie,/nisvartha_member_access=/);
 assert.match(setCookie,/httponly/i);
 assert.match(setCookie,/samesite=strict/i);
 const memberCookie=setCookie.split(';')[0];
 let view=await fetch(web+'/member',{headers:{Cookie:memberCookie}});
 assert.equal(view.status,200);
 let html=await view.text();
 assert.ok(html.includes('SUBMITTED'),'Pending application not rendered');
 assert.doesNotMatch(html,/>Earnings</,'Compensation navigation leaked while feature is disabled');
 assert.doesNotMatch(html,/Offline transaction confirmed:/,'Offline transaction data leaked while feature is disabled');
 assert.match(html,/Member workspace navigation/,'Authenticated Member sidebar missing in compiled SSR');
 assert.match(html,/data-member-view="overview"/,'Member dashboard should initially show overview');
 assert.match(html,/Your membership at a glance/,'Member overview must match Admin hierarchy');
 assert.match(html,/My profile/,'Profile entry missing from Member navigation');
 assert.match(html,/Account security|Security/,'Security entry missing from Member navigation');
 assert.doesNotMatch(html,/>Administrators</,'Admin-only navigation leaked into Member portal');

 const badChange=await fetch(web+'/api/member/actions/profile',{method:'POST',
  headers:{Origin:'https://attacker.invalid',Cookie:memberCookie,'Content-Type':'application/json'},body:'{}'});
 assert.equal(badChange.status,403,'Member cookie write CSRF gate bypass');
 const reviewer=await post('/api/admin/session/login',{
  email:'uat-'+staffId.slice(0,8)+'@example.invalid',password:staffPassword
 });
 assert.equal(reviewer.status,200,'Staff reviewer BFF login failed');
 const reviewerCookie=(reviewer.headers.get('set-cookie')||'').split(';')[0];
 const assistPath='/api/admin/backend/cms/membership/applications/register';
 assert.equal((await post(assistPath,{})).status,401,'Anonymous staff intake BFF exposed');
 const forged=await fetch(web+assistPath,{method:'POST',headers:{
  Origin:'https://forged.invalid',Cookie:reviewerCookie,'Content-Type':'application/json'
 },body:'{}'});
 assert.equal(forged.status,403,'Staff intake BFF cross-origin request not denied');
 const staffPage=await fetch(web+'/admin/members',{headers:{Cookie:reviewerCookie}});
 assert.equal(staffPage.status,200,'Admin membership module unavailable');
 const staffMarkup=await staffPage.text();
 assert.match(staffMarkup,/Register member \(staff-assisted\)/,'Staff registration panel absent');
 const assistedForm={email:'staff-'+email,displayName:'Assisted Browser Applicant',
  password:'Assisted-Member-Password-2026',termsVersion:'ci-terms',
  privacyVersion:'ci-privacy',communicationOptIn:false,consent:true,
  applicantPresent:true};
 const staffCreated=await post(assistPath,assistedForm,reviewerCookie);
 assert.equal(staffCreated.status,201,'Staff member registration failed '+(await staffCreated.clone().text()).slice(0,150));
 const staffCreatedBody=await staffCreated.json();
 assistedMemberId=staffCreatedBody.id;
 assistedApplicationId=staffCreatedBody.applicationReference;
 assert.equal(staffCreatedBody.status,'SUBMITTED');
 const assistedInDb=await db.membershipApplication.findUniqueOrThrow({where:{id:assistedApplicationId}});
 assert.equal(assistedInDb.registeredByStaffId,staffId);
 assert.equal(assistedInDb.registrationSource,'STAFF_ASSISTED');
 assert.equal(assistedInDb.consentEvidenceRef,null);
 assert.equal((await db.memberAccount.findUniqueOrThrow({where:{id:assistedMemberId}})).status,'PENDING');
 const list=await fetch(web+'/api/admin/backend/cms/membership/applications',{headers:{Cookie:reviewerCookie}});
 assert.equal(list.status,200,'Staff membership review list failed');
 assert.ok((await list.json()).some(a=>a.id===applicationId));
 const pagePath=web+'/api/admin/backend/cms/membership/applications/page';
 assert.equal((await fetch(pagePath+'?limit=1&status=SUBMITTED')).status,401,
  'Anonymous BFF pagination exposed');
 const paged=await fetch(pagePath+'?limit=1&status=SUBMITTED',{headers:{Cookie:reviewerCookie}});
 assert.equal(paged.status,200,'Paginated member review BFF failed '+(await paged.clone().text()).slice(0,180));
 const first=await paged.json();
 assert.equal(first.items.length,1,'Member review BFF did not forward page size');
 assert.equal(first.items[0].status,'SUBMITTED','Member review BFF lost status filter');
 assert.ok([applicationId,assistedApplicationId].includes(first.items[0].id),
  'Member review returned unexpected first application');
 assert.equal(first.nextCursor,first.items[0].id,'Keyset cursor must point to the last returned item');
 const secondResponse=await fetch(pagePath+'?limit=1&status=SUBMITTED&cursor='+encodeURIComponent(first.nextCursor),
  {headers:{Cookie:reviewerCookie}});
 assert.equal(secondResponse.status,200,'Second membership review page failed');
 const secondPage=await secondResponse.json();
 assert.equal(secondPage.items.length,1,'Review pagination lost an application');
 assert.equal(secondPage.items[0].status,'SUBMITTED');
 assert.equal(secondPage.nextCursor,null,'Two-record result should terminate at page two');
 assert.deepEqual(new Set([first.items[0].id,secondPage.items[0].id]),
  new Set([applicationId,assistedApplicationId]),
  'Public and staff-assisted applications must both appear exactly once');
 assert.equal((await fetch(pagePath+'?limit=1&limit=2',{headers:{Cookie:reviewerCookie}})).status,400,
  'Duplicate review query must be blocked at BFF');
 assert.equal((await fetch(pagePath+'?unexpected=1',{headers:{Cookie:reviewerCookie}})).status,400,
  'Unrecognized review query must be blocked at BFF');

 const staffAction=async(op,body)=>post('/api/admin/backend/cms/membership/applications/'+applicationId+'/'+op,body,reviewerCookie);
 assert.equal((await staffAction('review',{})).status,200);
 assert.equal((await staffAction('decide',{status:'APPROVED',reason:'Synthetic reviewer identity check approved'})).status,200);
 const historyPath=web+'/api/admin/backend/cms/membership/applications/'+applicationId+'/history';
 assert.equal((await fetch(historyPath)).status,401,'Anonymous application timeline must be denied');
 const timeline=await fetch(historyPath,{headers:{Cookie:reviewerCookie}});
 assert.equal(timeline.status,200,'Staff application timeline BFF failed');
 const timelineBody=await timeline.json();
 assert.equal(timelineBody.applicationId,applicationId);
 assert.deepEqual(new Set(timelineBody.events.map(e=>e.action)),
  new Set(['ACCOUNT_REGISTERED','MEMBER_APPLICATION_REVIEW','MEMBER_APPLICATION_APPROVED']),
  'Application timeline lost member or staff lifecycle events');
 assert.equal(timelineBody.truncated,false);
 assert.equal((await fetch(web+'/api/admin/backend/cms/membership/applications/not-a-uuid/history',
  {headers:{Cookie:reviewerCookie}})).status,404,'BFF must reject malformed application locator');

 view=await fetch(web+'/member',{headers:{Cookie:memberCookie}});
 assert.equal(view.status,200);
 html=await view.text();
 assert.ok(html.includes('APPROVED'),'Approved application not reflected in member SSR');
 const crossOrigin=await fetch(web+'/api/member/recovery/redeem',{
  method:'POST',headers:{Origin:'https://untrusted.invalid','Content-Type':'application/json'},body:'{}'
 });
 assert.equal(crossOrigin.status,403,'Recovery redemption CSRF check missing');
 const issue=await post('/api/admin/backend/cms/membership/recovery/'+memberId+'/issue',{
  identityVerified:true,identityEvidenceRef:'IDENTITY-BROWSER-UAT-2026'
 },reviewerCookie);
 assert.equal(issue.status,200,'Admin recovery issuance BFF failed: '+(await issue.clone().text()).slice(0,200));
 const recovery=await issue.json();
 assert.equal(recovery.code.length,43,'Admin recovery bearer malformed');
 const replacement='Web-Member-Recovered-Password-2026';
 const redeem=await post('/api/member/recovery/redeem',{code:recovery.code,newPassword:replacement});
 assert.equal(redeem.status,200,'Member BFF recovery redemption failed');
 assert.equal((await fetch(web+'/member',{headers:{Cookie:memberCookie},redirect:'manual'})).status,307,
  'Pre-reset member cookie must be revoked');
 assert.equal((await post('/api/member/session/login',{email,password})).status,401,'Old password accepted');
 const newLogin=await post('/api/member/session/login',{email,password:replacement});
 assert.equal(newLogin.status,200,'Recovered password does not allow login');
 const newCookie=(newLogin.headers.get('set-cookie')||'').split(';')[0];
 assert.ok(newCookie.includes('nisvartha_member_access='));
 assert.equal((await fetch(web+'/member',{headers:{Cookie:newCookie}})).status,200);
 assert.equal((await post('/api/member/recovery/redeem',{code:recovery.code,newPassword:'Replay-Must-Be-Rejected-2026'})).status,401,
  'One-time code replay accepted');
 assert.equal((await staffAction('decide',{status:'SUSPENDED',reason:'Synthetic UAT suspension check'})).status,200);
 assert.equal((await fetch(web+'/member',{headers:{Cookie:newCookie},redirect:'manual'})).status,307,'Suspended recovered session not invalidated');
 console.log('Compiled Next.js member login, HttpOnly BFF, CSRF, staff review and suspension: PASS');
}finally{
 for(const child of [frontend,backend])if(child?.pid){const exited=new Promise(resolve=>child.once('exit',resolve));try{process.kill(-child.pid,'SIGTERM')}catch{}await Promise.race([exited,new Promise(resolve=>setTimeout(resolve,2000))]);}
 if(assistedApplicationId)await db.membershipApplication.deleteMany({where:{id:assistedApplicationId}});
 if(assistedMemberId){
  await db.memberPasswordRecovery.deleteMany({where:{memberId:assistedMemberId}});
  await db.memberSession.deleteMany({where:{memberId:assistedMemberId}});
  await db.memberAudit.deleteMany({where:{memberId:assistedMemberId}});
  await db.memberAccount.deleteMany({where:{id:assistedMemberId}});
 }
 if(applicationId)await db.membershipApplication.deleteMany({where:{id:applicationId}});
 if(memberId){await db.memberPasswordRecovery.deleteMany({where:{memberId}});await db.memberSession.deleteMany({where:{memberId}});await db.memberAudit.deleteMany({where:{memberId}});await db.memberAccount.deleteMany({where:{id:memberId}});}
 await db.cmsAudit.deleteMany({where:{actorId:staffId}});
 await db.staffSession.deleteMany({where:{staffId}});
 await db.staffUser.deleteMany({where:{id:staffId}});
 await db.$disconnect();
}
