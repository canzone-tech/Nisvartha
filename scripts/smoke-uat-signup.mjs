import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const db=new (require('@prisma/client').PrismaClient)();
const argon2=require('argon2');
if(!process.env.DATABASE_URL||new URL(process.env.DATABASE_URL).pathname!=='/nisvartha_ci')
 throw Error('Synthetic PIN test must use isolated nisvartha_ci MySQL');
const port=await new Promise((resolve,reject)=>{
 const server=createServer();server.once('error',reject);
 server.listen(0,'127.0.0.1',()=>{
  const a=server.address();if(!a||typeof a==='string')return reject(Error('No test port'));
  server.close(()=>resolve(a.port));
 });
});
const api='http://127.0.0.1:'+port+'/api/v1';
const ids=[],staffIds=[randomUUID(),randomUUID()],batchIds=[];
const emails=()=>('uat-pin-'+randomUUID().slice(0,8)+'@example.invalid');
let child;
const request=async(path,method='GET',body,token)=>{
 const response=await fetch(api+path,{
  method,headers:{...(body?{'Content-Type':'application/json'}:{}),
   ...(token?{Authorization:'Bearer '+token}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const raw=await response.text();
 let data;try{data=JSON.parse(raw)}catch{data=raw}
 return {status:response.status,data};
};
const staffPassword='Nonfinancial-Uat-Staff-Password-2026';
const memberPassword='Nonfinancial-Uat-Member-Password-2026';
const policy={termsVersion:'ci-terms',privacyVersion:'ci-privacy',consent:true,communicationOptIn:false};
const signup=(code,email=emails(),inviteCode)=>({
 email,displayName:'Synthetic Test Applicant',password:memberPassword,
 ...policy,registrationPin:code,...(inviteCode?{inviteCode}:{})
});
const rows=()=>db.uatSignupPin.findMany({where:{batchId:{in:batchIds}}});
try{
 const pwHash=await argon2.hash(staffPassword,{
  type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1
 });
 await db.staffUser.createMany({data:[
  {id:staffIds[0],email:'uat-admin-'+staffIds[0].slice(0,8)+'@example.invalid',
   displayName:'Synthetic PIN Admin',passwordHash:pwHash,role:'ADMIN'},
  {id:staffIds[1],email:'uat-approver-'+staffIds[1].slice(0,8)+'@example.invalid',
   displayName:'Synthetic Reviewer',passwordHash:pwHash,role:'ADMIN'}
 ]});
 child=spawn(process.execPath,['backend/dist/main.js'],{
  env:{...process.env,PORT:String(port),NODE_ENV:'',
   NISVARTHA_UAT_PIN_REGISTRATION:'synthetic',
   MEMBER_PORTAL_ENABLED:'true',MEMBER_APPLICATIONS_ENABLED:'true',
   MEMBER_STAFF_REGISTRATION_ENABLED:'true',
   MEMBER_TERMS_VERSION:'ci-terms',MEMBER_PRIVACY_VERSION:'ci-privacy'},
  stdio:'ignore',detached:true
 });
 let ready=false;
 for(let n=0;n<80;n++){
  try{if((await fetch(api+'/health/ready')).ok){ready=true;break}}catch{}
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 assert.ok(ready,'Compiled UAT API failed readiness');
 const a=await request('/staff/login','POST',{
  email:'uat-admin-'+staffIds[0].slice(0,8)+'@example.invalid',password:staffPassword});
 const b=await request('/staff/login','POST',{
  email:'uat-approver-'+staffIds[1].slice(0,8)+'@example.invalid',password:staffPassword});
 assert.equal(a.status,200);assert.equal(b.status,200);
 const admin=a.data.accessToken,approver=admin;
 const issue='/cms/membership/uat-pins';
 const batch={quantity:5,expiresAt:'2099-01-31T23:59:00+05:30',requestKey:randomUUID()};
 assert.equal((await request(issue,'POST',batch)).status,401,'Anonymous PIN issuance exposed');
 assert.equal((await request(issue,'GET')).status,401,'Anonymous E-PIN inventory exposed');
 const issued=await request(issue,'POST',batch,admin);
 assert.equal(issued.status,201,'UAT issuance failed '+JSON.stringify(issued.data));
 assert.equal(issued.data.classification,'SYNTHETIC_NONFINANCIAL_UAT_ONLY');
 assert.equal(issued.data.codes.length,5);
 assert.equal(new Set(issued.data.codes).size,5,'Duplicate bearer created');
 assert.ok(issued.data.codes.every(x=>/^[A-Za-z0-9_-]{43}$/.test(x)));
 batchIds.push(issued.data.batchId);
 const inventory=await request(issue+'?status=AVAILABLE','GET',undefined,admin);
 assert.equal(inventory.status,200,'Admin E-PIN inventory unavailable');
 assert.equal(inventory.data.classification,'SYNTHETIC_NONFINANCIAL_UAT_ONLY');
 assert.equal(inventory.data.items.filter(pin=>pin.batchId===issued.data.batchId).length,5);
 assert.ok(inventory.data.items.every(pin=>!('tokenHash' in pin)&&!('codes' in pin)),'E-PIN secrets leaked');
 assert.equal((await request(issue,'POST',batch,admin)).status,409,
  'Idempotency retry generated new batch');
 assert.equal((await db.uatSignupPinBatch.count({where:{requestKey:batch.requestKey}})),1);
 const [c1,c2,c3,c4,c5]=issued.data.codes;
 const stored=await rows();assert.equal(stored.length,5);
 for(const record of stored){
  assert.ok(!issued.data.codes.includes(record.tokenHash),'Bearer stored in plaintext');
  assert.match(record.tokenHash,/^[0-9a-f]{64}$/);
 }
 const sponsor=await request('/members/register','POST',signup(c1));
 assert.equal(sponsor.status,201,'Sponsor synthetic signup failed '+JSON.stringify(sponsor.data));
 ids.push(sponsor.data.id);
 assert.equal(sponsor.data.status,'SUBMITTED');
 assert.equal((await db.memberAccount.findUniqueOrThrow({where:{id:sponsor.data.id}})).status,'PENDING');
 assert.equal((await db.uatSignupPin.count({where:{
  redeemedByMemberId:sponsor.data.id,redeemedAt:{not:null}}})),1);
 const review='/cms/membership/applications/'+sponsor.data.applicationReference;
 assert.equal((await request(review+'/review','POST',{},approver)).status,200);
 assert.equal((await request(review+'/decide','POST',{
  status:'APPROVED',reason:'Fake identity proof for synthetic test only'
 },approver)).status,200);
 const member=await request('/members/login','POST',{
  email:(await db.memberAccount.findUniqueOrThrow({where:{id:sponsor.data.id}})).email,
  password:memberPassword
 });
 assert.equal(member.status,200,'Sponsor login failed');
 const me=await request('/members/me','GET',undefined,member.data.accessToken);
 assert.equal(me.status,200);
 assert.match(me.data.referralCode,/^[A-Za-z0-9_-]{22}$/);
 const referred=await request('/members/register','POST',signup(c2,emails(),me.data.referralCode));
 assert.equal(referred.status,201,'Referred signup failed');
 ids.push(referred.data.id);
 const edge=await db.memberInvitation.findUniqueOrThrow({where:{inviteeId:referred.data.id}});
 assert.equal(edge.inviterId,sponsor.data.id);
 const assisted=await request('/cms/membership/applications/register','POST',{
  ...signup(c3,emails(),me.data.referralCode),
  applicantPresent:true,consentEvidenceRef:'CONSENT-SYNTHETIC-001'
 },admin);
 assert.equal(assisted.status,201,'Staff-assisted PIN + inviter signup failed '+JSON.stringify(assisted.data));
 ids.push(assisted.data.id);
 const assistedApp=await db.membershipApplication.findUniqueOrThrow({where:{memberId:assisted.data.id}});
 assert.equal(assistedApp.registrationSource,'STAFF_ASSISTED');
 assert.equal(assistedApp.registeredByStaffId,staffIds[0]);
 assert.equal((await db.memberInvitation.findUniqueOrThrow({where:{inviteeId:assisted.data.id}})).inviterId,sponsor.data.id);
 const again=await request('/members/me','GET',undefined,member.data.accessToken);
 assert.equal(again.data.invitedCount,2);
 const replay=await request('/members/register','POST',signup(c2));
 assert.equal(replay.status,400,'Consumed PIN replay allowed');
 const badInvite=await request('/cms/membership/applications/register','POST',{
  ...signup(c4,emails(),'AAAAAAAAAAAAAAAAAAAAAA'),
  applicantPresent:true,consentEvidenceRef:'CONSENT-SYNTHETIC-002'
 },admin);
 assert.equal(badInvite.status,400,'Invalid inviter accepted');
 assert.equal((await db.uatSignupPin.count({where:{
  tokenHash:stored.find(x=>x.displaySuffix===c4.slice(-6))?.tokenHash,
  redeemedAt:null
 }})),1,'Invalid inviter consumed a PIN');
 const corrected=await request('/cms/membership/applications/register','POST',{
  ...signup(c4),applicantPresent:true,consentEvidenceRef:'CONSENT-SYNTHETIC-003'
 },admin);
 assert.equal(corrected.status,201,'Rolled-back PIN cannot be reused');
 ids.push(corrected.data.id);
 const concurrency=[signup(c5),signup(c5)];
 const races=await Promise.all(concurrency.map(form=>request('/members/register','POST',form)));
 assert.deepEqual(races.map(x=>x.status).sort((a,b)=>a-b),[201,400],
  'Concurrent code redemption was not exactly once: '+JSON.stringify(races.map(x=>x.status)));
 ids.push(races.find(x=>x.status===201).data.id);
 assert.equal((await db.uatSignupPin.count({where:{redeemedAt:{not:null},batchId:issued.data.batchId}})),5);
 const usedInventory=await request(issue+'?status=USED','GET',undefined,admin);
 assert.equal(usedInventory.status,200);
 assert.equal(usedInventory.data.items.filter(pin=>pin.batchId===issued.data.batchId).length,5);
 assert.ok(usedInventory.data.items.every(pin=>pin.status==='USED'));
 assert.equal((await request(issue+'?cursor=not-a-uuid','GET',undefined,admin)).status,400);
 assert.equal((await db.memberInvitation.count({where:{inviterId:sponsor.data.id}})),2);
 assert.equal((await db.cmsAudit.count({where:{actorId:staffIds[0],action:'UAT_SIGNUP_PINS_CREATED'}})),1);
 console.log('Synthetic E-PIN issue, single-use, idempotency, concurrent claims, staff/public signup, inviter attribution and RBAC: PASS');
}finally{
 if(child?.pid){const done=new Promise(r=>child.once('exit',r));try{process.kill(-child.pid,'SIGTERM')}catch{}await Promise.race([done,new Promise(r=>setTimeout(r,2000))]);}
 await db.memberInvitation.deleteMany({where:{OR:[
  {inviterId:{in:ids}},{inviteeId:{in:ids}}
 ]}});
 await db.uatSignupPin.deleteMany({where:{batchId:{in:batchIds}}});
 await db.uatSignupPinBatch.deleteMany({where:{id:{in:batchIds}}});
 await db.membershipApplication.deleteMany({where:{memberId:{in:ids}}});
 await db.memberSession.deleteMany({where:{memberId:{in:ids}}});
 await db.memberAudit.deleteMany({where:{memberId:{in:ids}}});
 await db.memberAccount.deleteMany({where:{id:{in:ids}}});
 await db.cmsAudit.deleteMany({where:{actorId:{in:staffIds}}});
 await db.staffSession.deleteMany({where:{staffId:{in:staffIds}}});
 await db.staffUser.deleteMany({where:{id:{in:staffIds}}});
 await db.$disconnect();
}
