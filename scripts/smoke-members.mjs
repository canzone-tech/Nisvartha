import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const argon2=require('argon2');
if(!process.env.DATABASE_URL||new URL(process.env.DATABASE_URL).pathname!=='/nisvartha_ci')
 throw new Error('Member smoke test requires isolated nisvartha_ci DB');
const db=new PrismaClient();
const id=randomUUID(),staffId=randomUUID();
const email='synthetic-'+id.slice(0,8)+'@example.invalid';
const password='Synthetic-Applicant-Password-2026',nextPassword='Synthetic-New-Password-2026';
const port=await new Promise((resolve,reject)=>{
 const s=createServer();s.once('error',reject);
 s.listen(0,'127.0.0.1',()=>{const a=s.address();if(!a||typeof a==='string')return reject(Error('Port invalid'));s.close(()=>resolve(a.port));});
});
const api='http://127.0.0.1:'+port+'/api/v1';
let child,applicationId,memberId,withdrawnMemberId,withdrawnApplicationId;
async function request(path,method='GET',body,token){
 const response=await fetch(api+path,{
  method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const raw=await response.text();
 let data;try{data=JSON.parse(raw)}catch{data=raw}
 return {status:response.status,data};
}
try{
 const hash=await argon2.hash('Synthetic-Admin-Password-2026',{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
 await db.staffUser.create({data:{id:staffId,email:'review-'+staffId.slice(0,8)+'@example.invalid',
  displayName:'Synthetic Reviewer',passwordHash:hash,role:'APPROVER'}});
 child=spawn(process.execPath,['backend/dist/main.js'],{
  env:{...process.env,PORT:String(port),
   MEMBER_PORTAL_ENABLED:'true',MEMBER_APPLICATIONS_ENABLED:'true',
   MEMBER_TERMS_VERSION:'test-terms-v1',MEMBER_PRIVACY_VERSION:'test-privacy-v1'},
  stdio:'ignore',detached:true
 });
 let ready=false;
 for(let i=0;i<80;i++){
  try{if((await fetch(api+'/health/ready')).ok){ready=true;break}}catch{}
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 assert.ok(ready,'Compiled API not ready for membership UAT');
 const form={
  email,displayName:'Synthetic Applicant',password,
  termsVersion:'test-terms-v1',privacyVersion:'test-privacy-v1',
  consent:true,communicationOptIn:false
 };
 assert.equal((await request('/members/register','POST',{...form,consent:false})).status,400,'Consent required');
 assert.equal((await request('/members/register','POST',{...form,termsVersion:'wrong'})).status,400,'Policy version required');
 const registered=await request('/members/register','POST',form);
 assert.equal(registered.status,201,'Registration failed '+JSON.stringify(registered.data));
 applicationId=registered.data.applicationReference;
 memberId=registered.data.id;
 assert.equal(registered.data.status,'SUBMITTED');
 assert.equal((await request('/members/register','POST',form)).status,409,'Duplicate email must be rejected');
 assert.equal((await request('/members/me')).status,401,'Member data must be authenticated');
 assert.equal((await request('/members/login','POST',{email,password:'wrong-pass'})).status,401,'Incorrect login should fail');
 const login=await request('/members/login','POST',{email,password});
 assert.equal(login.status,200,'Applicant login failed');
 let memberToken=login.data.accessToken;assert.ok(memberToken?.length>30);
 const member=await request('/members/me','GET',undefined,memberToken);
 assert.equal(member.status,200);
 assert.equal(member.data.application.status,'SUBMITTED');
 assert.equal(member.data.status,'PENDING');
 const changed=await request('/members/profile','PATCH',{displayName:'Updated Synthetic Applicant',communicationOptIn:true},memberToken);
 assert.equal(changed.status,200);
 assert.equal(changed.data.displayName,'Updated Synthetic Applicant');
 const reviewer=await request('/staff/login','POST',{email:'review-'+staffId.slice(0,8)+'@example.invalid',password:'Synthetic-Admin-Password-2026'});
 assert.equal(reviewer.status,200);
 const staffToken=reviewer.data.accessToken;
 const historyPath='/cms/membership/applications/'+applicationId+'/history';
 assert.equal((await request(historyPath)).status,401,'Anonymous application history exposed');
 assert.equal((await request(historyPath,'GET',undefined,memberToken)).status,401,'Member bearer accepted as staff');
 assert.equal((await request('/cms/membership/applications/not-a-uuid/history','GET',undefined,staffToken)).status,400,
  'Malformed application ID accepted');
 assert.equal((await request('/cms/membership/applications/'+randomUUID()+'/history','GET',undefined,staffToken)).status,404,
  'Missing application must not expose history');
 const createdTimeline=await request(historyPath,'GET',undefined,staffToken);
 assert.equal(createdTimeline.status,200);
 assert.equal(createdTimeline.data.applicationId,applicationId);
 assert.deepEqual(createdTimeline.data.events.map(event=>event.action),['ACCOUNT_REGISTERED']);
 assert.equal(createdTimeline.data.events[0].actorId,memberId);
 assert.equal(createdTimeline.data.events[0].actorKind,'MEMBER');

 assert.equal((await request('/cms/membership/applications')).status,401,'Public membership review must reject anonymous');
 const review=await request('/cms/membership/applications/'+applicationId+'/review','POST',{},staffToken);
 assert.equal(review.status,200,'Review transition failed');
 assert.equal((await request('/cms/membership/applications/'+applicationId+'/review','POST',{},staffToken)).status,409,'Duplicate review must fail');
 const approved=await request('/cms/membership/applications/'+applicationId+'/decide','POST',
  {status:'APPROVED',reason:'Synthetic nonfinancial application reviewed and verified'},staffToken);
 assert.equal(approved.status,200);
 assert.equal(approved.data.status,'APPROVED');
 assert.equal((await request('/members/me','GET',undefined,memberToken)).data.status,'ACTIVE');
 const approvedHistory=await request(historyPath,'GET',undefined,staffToken);
 assert.equal(approvedHistory.status,200,'Review history unavailable after approval');
 assert.deepEqual(new Set(approvedHistory.data.events.map(e=>e.action)),
  new Set(['ACCOUNT_REGISTERED','MEMBER_APPLICATION_REVIEW','MEMBER_APPLICATION_APPROVED']));
 assert.ok(approvedHistory.data.events.some(e=>e.actorKind==='STAFF'&&e.actorId===staffId));
 assert.equal(approvedHistory.data.truncated,false);
 assert.ok(!JSON.stringify(approvedHistory.data).includes('Synthetic nonfinancial application reviewed and verified'),
  'Private decision reason leaked into audit history');

 assert.equal((await request('/cms/membership/applications/'+applicationId+'/decide','POST',{status:'APPROVED',reason:'Double approval must not work'},staffToken)).status,409);
 const updatePassword=await request('/members/password','POST',{currentPassword:password,newPassword:nextPassword},memberToken);
 assert.equal(updatePassword.status,200);
 assert.equal((await request('/members/me','GET',undefined,memberToken)).status,401,'Password update must revoke old session');
 assert.equal((await request('/members/login','POST',{email,password})).status,401,'Old password must fail');
 const second=await request('/members/login','POST',{email,password:nextPassword});
 assert.equal(second.status,200);
 memberToken=second.data.accessToken;
 const suspended=await request('/cms/membership/applications/'+applicationId+'/decide','POST',{
  status:'SUSPENDED',reason:'Synthetic suspension for security regression'
 },staffToken);
 assert.equal(suspended.status,200);
 assert.equal((await request('/members/me','GET',undefined,memberToken)).status,401,'Suspension must disable sessions');
 assert.equal((await request('/members/login','POST',{email,password:nextPassword})).status,401,'Suspended login must fail');

 const suspendedHistory=await request(historyPath,'GET',undefined,staffToken);
 assert.equal(suspendedHistory.status,200);
 assert.ok(suspendedHistory.data.events.some(e=>e.action==='MEMBER_APPLICATION_SUSPENDED'));
 assert.ok(!suspendedHistory.data.events.some(e=>e.action==='PASSWORD_CHANGED_SESSIONS_REVOKED'),
  'Security events must not appear in review lifecycle timeline');
 for(const event of suspendedHistory.data.events){
  assert.deepEqual(Object.keys(event).sort(),
   ['action','actorId','actorKind','createdAt','id','summary']);
  assert.ok(!JSON.stringify(event).includes('tokenHash'));
 }
 const alternate={...form,email:'withdrawn-'+id.slice(0,8)+'@example.invalid',
  displayName:'Synthetic Withdrawn Applicant'};
 const registeredWithdrawn=await request('/members/register','POST',alternate);
 assert.equal(registeredWithdrawn.status,201);
 withdrawnMemberId=registeredWithdrawn.data.id;
 withdrawnApplicationId=registeredWithdrawn.data.applicationReference;
 const secondLogin=await request('/members/login','POST',{email:alternate.email,password});
 assert.equal(secondLogin.status,200);
 const withdrawn=await request('/members/application/withdraw','POST',{},secondLogin.data.accessToken);
 assert.equal(withdrawn.status,200,'Member withdrawal transition failed');
 const withdrawnHistory=await request('/cms/membership/applications/'+withdrawnApplicationId+'/history',
  'GET',undefined,staffToken);
 assert.equal(withdrawnHistory.status,200);
 assert.deepEqual(new Set(withdrawnHistory.data.events.map(e=>e.action)),
  new Set(['ACCOUNT_REGISTERED','APPLICATION_WITHDRAWN']));
 assert.ok(withdrawnHistory.data.events.every(e=>e.actorKind==='MEMBER'&&e.actorId===withdrawnMemberId));
 assert.ok(!withdrawnHistory.data.events.some(e=>e.actorId===memberId||e.actorId===staffId),
  'A separate application leaked another applicant review events');
 assert.ok(!suspendedHistory.data.events.some(e=>e.actorId===withdrawnMemberId));
 const events=await db.memberAudit.findMany({where:{memberId}});
 assert.ok(events.some(e=>e.action==='ACCOUNT_REGISTERED'));
 assert.ok(events.some(e=>e.action==='PASSWORD_CHANGED_SESSIONS_REVOKED'));
 const staffLogs=await db.cmsAudit.findMany({where:{objectType:'MEMBER_APPLICATION',objectId:applicationId}});
 assert.ok(staffLogs.some(e=>e.action==='MEMBER_APPLICATION_APPROVED'));
 assert.ok(staffLogs.some(e=>e.action==='MEMBER_APPLICATION_SUSPENDED'));
 const fresh=await db.membershipApplication.findUniqueOrThrow({where:{id:applicationId}});
 assert.equal(fresh.termsVersion,'test-terms-v1');
 assert.equal(fresh.privacyVersion,'test-privacy-v1');
 console.log('Nonfinancial member registration/login, privacy versions, approval, RBAC, password revocation and suspension: PASS');
}finally{
 if(child?.pid){const exited=new Promise(resolve=>child.once('exit',resolve));try{process.kill(-child.pid,'SIGTERM')}catch{}await Promise.race([exited,new Promise(resolve=>setTimeout(resolve,2000))]);}
 if(withdrawnApplicationId)await db.membershipApplication.deleteMany({where:{id:withdrawnApplicationId}});
 if(withdrawnMemberId){
  await db.memberSession.deleteMany({where:{memberId:withdrawnMemberId}});
  await db.memberAudit.deleteMany({where:{memberId:withdrawnMemberId}});
  await db.memberAccount.deleteMany({where:{id:withdrawnMemberId}});
 }
 if(applicationId)await db.membershipApplication.deleteMany({where:{id:applicationId}});
 if(memberId){
  await db.memberSession.deleteMany({where:{memberId}});
  await db.memberAudit.deleteMany({where:{memberId}});
  await db.memberAccount.deleteMany({where:{id:memberId}});
 }
 await db.cmsAudit.deleteMany({where:{actorId:staffId}});
 await db.staffSession.deleteMany({where:{staffId}});
 await db.staffUser.deleteMany({where:{id:staffId}});
 await db.$disconnect();
}
