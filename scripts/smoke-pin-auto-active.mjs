import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {randomUUID,randomInt} from 'node:crypto';
import {createRequire} from 'node:module';

const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const argon2=require('argon2');
if(!process.env.DATABASE_URL||new URL(process.env.DATABASE_URL).pathname!=='/nisvartha_ci')
 throw Error('M3 auto-active smoke must use the isolated CI MySQL database');
const db=new PrismaClient();
const freePort=()=>new Promise((resolve,reject)=>{
 const s=createServer();s.once('error',reject);
 s.listen(0,'127.0.0.1',()=>{
  const address=s.address();
  if(!address||typeof address==='string')return reject(Error('Port unavailable'));
  s.close(()=>resolve(address.port));
 });
});
const port=await freePort();
const api='http://127.0.0.1:'+port+'/api/v1';
const sid=randomUUID(),members=[],batches=[];
const adminEmail='root-admin-'+sid.slice(0,8)+'@example.invalid';
const password='M3-Fake-Admin-2026-Strong';
const memberPassword='M3-Fake-Member-2026-Strong';
const signup=(registrationPin,inviteCode)=>({
 email:'m3-'+randomUUID().slice(0,10)+'@example.invalid',
 mobile:'+91'+randomInt(1_000_000_000,10_000_000_000),
 displayName:'M3 Test Member',password:memberPassword,
 ...(registrationPin?{registrationPin}:{}),...(inviteCode?{inviteCode}:{}),
 termsVersion:'m3-terms-test',privacyVersion:'m3-privacy-test',
 consent:true,communicationOptIn:false
});
let child;
const seedId=randomUUID();
async function seedThrough(target){
 const state=await db.matrixState.findUniqueOrThrow({where:{id:1}});
 if(state.nextSequence>target)return;
 const parents=await db.matrixPosition.findMany({select:{sequence:true,id:true}});
 const bySequence=new Map(parents.map(x=>[x.sequence,x.id]));
 let sequence=state.nextSequence;
 while(sequence<=target){
  // Parent rows must already be committed; insert children by global BFS level.
  let first=1,last=1;
  while(last<sequence){first=last+1;last=last*3+1}
  const end=Math.min(target,last);
  for(let offset=sequence;offset<=end;offset+=250){
   const data=[];
   for(let number=offset;number<=Math.min(offset+249,end);number++){
    const parentSequence=Math.floor((number-2)/3)+1;
    const parentId=bySequence.get(parentSequence);
    assert.ok(parentId,'Missing BFS parent for sequence '+number);
    const id=randomUUID();
    data.push({id,sequence:number,entryKey:'M5-SEED:'+number,
     memberId:seedId,parentId,slot:((number-2)%3)+1,kind:'ORIGINAL'});
    bySequence.set(number,id);
   }
   await db.matrixPosition.createMany({data});
  }
  sequence=end+1;
 }
 await db.matrixState.update({where:{id:1},data:{nextSequence:target+1}});
}
async function request(path,method='GET',body,token){
 const res=await fetch(api+path,{method,headers:{
  ...(body?{'Content-Type':'application/json'}:{}),
  ...(token?{Authorization:'Bearer '+token}:{})
 },...(body?{body:JSON.stringify(body)}:{})});
 const raw=await res.text();
 let data;try{data=JSON.parse(raw)}catch{data=raw}
 return {status:res.status,data};
}
try{
 const empty=await db.matrixPosition.count();
 assert.equal(empty,0,'Matrix baseline must be empty for one-time root test');
 const staffHash=await argon2.hash(password,{
  type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
 await db.staffUser.create({data:{id:sid,email:adminEmail,
  displayName:'Root Admin',passwordHash:staffHash,role:'ADMIN'}});
 child=spawn(process.execPath,['backend/dist/main.js'],{
  env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),
   REGISTRATION_ACCESS_PIN_ENABLED:'true',NISVARTHA_UAT_PIN_REGISTRATION:'false',
   MEMBER_PIN_AUTO_ACTIVATE_ENABLED:'true',MEMBER_PORTAL_ENABLED:'true',
   MEMBER_APPLICATIONS_ENABLED:'true',MEMBER_STAFF_REGISTRATION_ENABLED:'true',
   MATRIX_PLACEMENT_ENABLED:'true',MEMBER_COMPENSATION_ENABLED:'false',
   MEMBER_COMPENSATION_APPROVED:'false',
   MEMBER_TERMS_VERSION:'m3-terms-test',MEMBER_PRIVACY_VERSION:'m3-privacy-test'},
  detached:true,stdio:'ignore'});
 let live=false;
 for(let i=0;i<100;i++){
  try{const resp=await fetch(api+'/health/ready');if(resp.ok){live=true;break}}catch{}
  await new Promise(resolve=>setTimeout(resolve,150));
 }
 assert.ok(live,'Compiled API failed readiness in auto-active mode');
 const staff=await request('/staff/login','POST',{email:adminEmail,password});
 assert.equal(staff.status,200,'Admin login failed');
 const token=staff.data.accessToken;
 const rootInput={...signup(),applicantPresent:true};
 assert.equal((await request('/cms/membership/root','POST',rootInput)).status,401,
  'Anonymous root creation must be forbidden');
 const root=await request('/cms/membership/root','POST',rootInput,token);
 assert.equal(root.status,201,'Admin root creation failed: '+JSON.stringify(root.data));
 members.push(root.data.id);
 assert.equal(root.data.status,'APPROVED','Root must be active immediately');
 const rootAccount=await db.memberAccount.findUniqueOrThrow({where:{id:root.data.id}});
 assert.equal(rootAccount.status,'ACTIVE');
 assert.match(rootAccount.referralCode,/^[A-Z0-9]{8}$/);
 const original=await db.matrixPosition.findUniqueOrThrow({where:{entryKey:'ORIGINAL:'+root.data.id}});
 assert.equal(original.sequence,1);
 assert.equal(original.slot,0);
 assert.equal(original.parentId,null);
 const repeat=await request('/cms/membership/root','POST',{...rootInput,email:'root2-'+sid.slice(0,8)+'@example.invalid'},token);
 assert.equal(repeat.status,409,'Second root should be denied');
 assert.equal(await db.memberAccount.count({where:{email:'root2-'+sid.slice(0,8)+'@example.invalid'}}),0);
 const issue=await request('/cms/membership/registration-pins','POST',{
  requestKey:randomUUID(),quantity:2,expiresAt:'2099-12-31T23:59:00+05:30'
 },token);
 assert.equal(issue.status,201,'Admin E-PIN issuance failed: '+JSON.stringify(issue.data));
 batches.push(issue.data.batchId);
 const [firstPin,secondPin]=issue.data.codes;
 const firstPayload=signup(firstPin,rootAccount.referralCode.toLowerCase());
 const registered=await request('/members/register','POST',firstPayload);
 assert.equal(registered.status,201,'PIN member signup failed: '+JSON.stringify(registered.data));
 members.push(registered.data.id);
 assert.equal(registered.data.status,'APPROVED','E-PIN signup must skip human approval');
 const first=await db.memberAccount.findUniqueOrThrow({where:{id:registered.data.id}});
 assert.equal(first.status,'ACTIVE');
 assert.match(first.referralCode,/^[A-Z0-9]{8}$/);
 const pos2=await db.matrixPosition.findUniqueOrThrow({where:{entryKey:'ORIGINAL:'+first.id}});
 assert.equal(pos2.sequence,2);
 assert.equal(pos2.slot,1);
 assert.equal(pos2.parentId,original.id);
 assert.equal((await db.memberInvitation.findUniqueOrThrow({where:{inviteeId:first.id}})).inviterId,root.data.id);
 const logged=await request('/members/login','POST',{identifier:first.referralCode.toLowerCase(),password:memberPassword});
 assert.equal(logged.status,200,'Referral-code login must work');
 assert.equal(logged.data.member.id,first.id);
 assert.equal((await request('/members/login','POST',{email:firstPayload.email,password:memberPassword})).status,200);
 assert.equal((await request('/members/login','POST',{identifier:first.referralCode,password:'wrong'})).status,401);
 const dashboard=await request('/members/me','GET',undefined,logged.data.accessToken);
 assert.equal(dashboard.status,200);
 assert.equal(dashboard.data.referralCode,first.referralCode);
 const reused=await request('/members/register','POST',signup(firstPin,rootAccount.referralCode));
 assert.equal(reused.status,400,'Used PIN must be rejected');
 const invalid=await request('/members/register','POST',signup(secondPin,'ZZZZZZZZ'));
 assert.equal(invalid.status,400,'Unknown referral must be rejected');
 assert.equal(await db.registrationPin.count({where:{batchId:issue.data.batchId,redeemedAt:null}}),1,
  'Invalid referral must not consume a PIN');
 const race=await Promise.all([
  request('/members/register','POST',signup(secondPin,rootAccount.referralCode)),
  request('/members/register','POST',signup(secondPin,rootAccount.referralCode))
 ]);
 assert.deepEqual(race.map(x=>x.status).sort((a,b)=>a-b),[201,400],
  'Concurrent PIN claim must have exactly one winner');
 members.push(race.find(x=>x.status===201).data.id);
 const positions=await db.matrixPosition.findMany({orderBy:{sequence:'asc'},select:{sequence:true,slot:true}});
 assert.deepEqual(positions.map(x=>[x.sequence,x.slot]),[[1,0],[2,1],[3,2]]);
 assert.equal(await db.memberEarning.count({where:{beneficiaryMemberId:{in:members}}}),0,
  'Nonfinancial activation must not mint recruitment earnings');
 assert.equal(await db.memberOfflineSale.count({where:{memberId:{in:members}}}),0,
  'Admin E-PIN must not fabricate payment evidence');
 // Start another compiled API process using the same authoritative DB.
 // Existing security throttles remain unchanged (5 signups/minute).
 const stopped=new Promise(resolve=>child.once('exit',resolve));
 try{process.kill(-child.pid,'SIGTERM')}catch{}
 await Promise.race([stopped,new Promise(resolve=>setTimeout(resolve,2500))]);
 child=spawn(process.execPath,['backend/dist/main.js'],{
  env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),
   REGISTRATION_ACCESS_PIN_ENABLED:'true',NISVARTHA_UAT_PIN_REGISTRATION:'false',
   MEMBER_PIN_AUTO_ACTIVATE_ENABLED:'true',MEMBER_PORTAL_ENABLED:'true',
   MEMBER_APPLICATIONS_ENABLED:'true',MEMBER_STAFF_REGISTRATION_ENABLED:'true',
   MATRIX_PLACEMENT_ENABLED:'true',MEMBER_COMPENSATION_ENABLED:'false',
   MEMBER_COMPENSATION_APPROVED:'false',
   MEMBER_TERMS_VERSION:'m3-terms-test',MEMBER_PRIVACY_VERSION:'m3-privacy-test'},
  detached:true,stdio:'ignore'});
 let restarted=false;
 for(let index=0;index<100;index++){
  try{if((await fetch(api+'/health/ready')).ok){restarted=true;break}}catch{}
  await new Promise(resolve=>setTimeout(resolve,150));
 }
 assert.ok(restarted,'API failed to restart with preexisting matrix state');
 await db.memberAccount.create({data:{id:seedId,
  email:'m5-fixture-'+seedId+'@example.invalid',displayName:'M5 BFS Fixture',
  passwordHash:'fixture-no-login',status:'ACTIVE'}});
 members.push(seedId);
 const triggers=await request('/cms/membership/registration-pins','POST',{
  requestKey:randomUUID(),quantity:4,expiresAt:'2099-12-31T23:59:00+05:30'
 },token);
 assert.equal(triggers.status,201,'Could not issue rebirth trigger E-PINs');
 batches.push(triggers.data.batchId);
 const [l4,l5,rebirthL4,rebirthL5]=triggers.data.codes;
 async function trigger(pin,expectedSequence){
  const account=await request('/members/register','POST',signup(pin,rootAccount.referralCode));
  assert.equal(account.status,201,'Rebirth trigger must activate');
  members.push(account.data.id);
  const placement=await db.matrixPosition.findUniqueOrThrow({
   where:{entryKey:'ORIGINAL:'+account.data.id}
  });
  assert.equal(placement.sequence,expectedSequence,'Unexpected BFS trigger position');
 }
 await seedThrough(120);
 await trigger(l4,121);
 let children=await db.matrixPosition.findMany({where:{sourcePositionId:original.id},
  orderBy:{sequence:'asc'}});
 assert.deepEqual(children.map(x=>[x.sequence,x.triggerLevel,x.rebirthOrdinal]),[[122,4,1]],
  'Level 4 must create exactly one rebirth without compensation');
 assert.equal((await db.matrixPosition.findUniqueOrThrow({where:{id:original.id}})).completedAt,null);
 await seedThrough(363);
 await trigger(l5,364);
 children=await db.matrixPosition.findMany({where:{sourcePositionId:original.id},
  orderBy:{sequence:'asc'}});
 assert.deepEqual(children.map(x=>[x.sequence,x.triggerLevel,x.rebirthOrdinal]),
  [[122,4,1],[366,5,1],[367,5,2],[368,5,3]],'Original must create exactly four rebirth IDs after an independent L4 completion');
 assert.ok((await db.matrixPosition.findUniqueOrThrow({where:{id:original.id}})).completedAt);
 const rootLogin=await request('/members/login','POST',{identifier:rootAccount.referralCode,password:memberPassword});
 assert.equal(rootLogin.status,200,'Completed position must not disable owner login');
 const matrix=await request('/members/matrix','GET',undefined,rootLogin.data.accessToken);
 assert.equal(matrix.status,200);
 assert.ok(matrix.data.root.completedAt);
 assert.equal(matrix.data.rebirthPositions.filter(x=>x.sourceSequence===1).length,4);
 const firstRebirth=children[0];
 await seedThrough(9921);
 await trigger(rebirthL4,9922);
 let second=await db.matrixPosition.findMany({where:{sourcePositionId:firstRebirth.id},
  orderBy:{sequence:'asc'}});
 assert.deepEqual(second.map(x=>[x.sequence,x.triggerLevel,x.rebirthOrdinal]),[[9923,4,1]],
  'A rebirth ID must create its own second generation at Level 4');
 await seedThrough(29766);
 await trigger(rebirthL5,29767);
 second=await db.matrixPosition.findMany({where:{sourcePositionId:firstRebirth.id},
  orderBy:{sequence:'asc'}});
 assert.deepEqual(second.map(x=>[x.sequence,x.triggerLevel,x.rebirthOrdinal]),
  [[9923,4,1],[29769,5,1],[29770,5,2],[29771,5,3]],
  'Each rebirth must create one plus three of its own at Level 5');
 assert.ok((await db.matrixPosition.findUniqueOrThrow({where:{id:firstRebirth.id}})).completedAt,
  'Second-generation source must close independently');
 assert.equal((await db.matrixPosition.findUniqueOrThrow({where:{id:children[1].id}})).completedAt,null,
  'Other rebirth IDs must continue their independent cycles');
 assert.equal(await db.memberEarning.count(),0,'No unapproved financial accrual from 30k placements');
 assert.equal(await db.memberOfflineSale.count(),0,'No fabricated joining payment from E-PIN');
 console.log('M5 original and rebirth-of-rebirth 1+3, read-only closure, BFS, zero unapproved earnings: PASS');
 console.log('M3 root, immediate E-PIN activation, BFS, 8-char codes, email/code login, replay/concurrency and finance HOLD: PASS');
}finally{
 if(child?.pid){
  const exited=new Promise(resolve=>child.once('exit',resolve));
  try{process.kill(-child.pid,'SIGTERM')}catch{}
  await Promise.race([exited,new Promise(resolve=>setTimeout(resolve,2000))]);
 }
 const end=(await db.matrixPosition.aggregate({_max:{sequence:true}}))._max.sequence??0;
 const ranges=[];let first=1,last=1;
 while(first<=end){ranges.push({first,last});first=last+1;last=last*3+1;}
 for(const range of ranges.reverse())
  await db.matrixPosition.deleteMany({where:{sequence:{gte:range.first,lte:range.last}}});
 if(end)await db.matrixState.update({where:{id:1},data:{nextSequence:1}});
 await db.memberInvitation.deleteMany({where:{OR:[
  {inviterId:{in:members}},{inviteeId:{in:members}}
 ]}});
 await db.registrationPin.deleteMany({where:{batchId:{in:batches}}});
 await db.registrationPinBatch.deleteMany({where:{id:{in:batches}}});
 await db.memberSession.deleteMany({where:{memberId:{in:members}}});
 await db.memberAudit.deleteMany({where:{memberId:{in:members}}});
 await db.membershipApplication.deleteMany({where:{memberId:{in:members}}});
 await db.memberAccount.deleteMany({where:{id:{in:members}}});
 await db.cmsAudit.deleteMany({where:{actorId:sid}});
 await db.staffSession.deleteMany({where:{staffId:sid}});
 await db.staffUser.deleteMany({where:{id:sid}});
 await db.$disconnect();
}
