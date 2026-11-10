import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {randomInt,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';

const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const argon2=require('argon2');
if(!process.env.DATABASE_URL||new URL(process.env.DATABASE_URL).pathname!=='/nisvartha_ci')
 throw Error('Suspension matrix regression must use isolated disposable CI MySQL');

const db=new PrismaClient();
const port=await new Promise((resolve,reject)=>{
 const s=createServer();s.once('error',reject);
 s.listen(0,'127.0.0.1',()=>{
  const address=s.address();
  if(!address||typeof address==='string')return reject(Error('Port unavailable'));
  s.close(()=>resolve(address.port));
 });
});
const api='http://127.0.0.1:'+port+'/api/v1';
const staffId=randomUUID(),seedId=randomUUID();
const staffEmail='susp-matrix-'+staffId.slice(0,8)+'@example.invalid';
const staffPassword='Suspension-Matrix-Admin-2026';
const memberPassword='Suspension-Matrix-Member-2026';
const memberIds=[seedId],batchIds=[];
const signup=(pin,inviter)=>({
 email:'susp-'+randomUUID().slice(0,12)+'@example.invalid',
 mobile:'+91'+randomInt(1_000_000_000,10_000_000_000),
 displayName:'Suspension Matrix Fixture',password:memberPassword,
 ...(pin?{registrationPin:pin}:{}),...(inviter?{inviteCode:inviter}:{}),
 termsVersion:'suspension-terms',privacyVersion:'suspension-privacy',
 consent:true,communicationOptIn:false
});
const request=async(path,method='GET',body,token)=>{
 const r=await fetch(api+path,{method,headers:{
  ...(body?{'Content-Type':'application/json'}:{}),
  ...(token?{Authorization:'Bearer '+token}:{})
 },...(body?{body:JSON.stringify(body)}:{})});
 const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}
 return {status:r.status,data};
};
// Synthetic filler positions isolate precisely the 202nd/607th placement
// triggers; no real member, earnings, or PIN transaction is invented.
async function seedThrough(target){
 const state=await db.matrixState.findUniqueOrThrow({where:{id:1}});
 const start=state.nextSequence;
 if(start>target)return;
 const existing=await db.matrixPosition.findMany({select:{sequence:true,id:true}});
 const bySequence=new Map(existing.map(row=>[row.sequence,row.id]));
 let sequence=start;
 while(sequence<=target){
  let last=1;
  while(last<sequence)last=last*3+1;
  const end=Math.min(last,target);
  for(let offset=sequence;offset<=end;offset+=200){
   const data=[];
   for(let number=offset;number<=Math.min(offset+199,end);number++){
    const parentId=bySequence.get(Math.floor((number-2)/3)+1);
    assert.ok(parentId,'Missing predecessor for BFS sequence '+number);
    const id=randomUUID();
    data.push({id,sequence:number,entryKey:'SUSPENSION-SEED:'+number,
     memberId:seedId,parentId,slot:((number-2)%3)+1,kind:'ORIGINAL'});
    bySequence.set(number,id);
   }
   await db.matrixPosition.createMany({data});
  }
  sequence=end+1;
 }
 await db.matrixState.update({where:{id:1},data:{nextSequence:target+1}});
}
let child;
try{
 assert.equal(await db.matrixPosition.count(),0,'Requires an empty disposable matrix');
 assert.equal((await db.matrixState.findUniqueOrThrow({where:{id:1}})).nextSequence,1);
 const hash=await argon2.hash(staffPassword,{
  type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1
 });
 await db.staffUser.create({data:{id:staffId,email:staffEmail,
  displayName:'Matrix Suspension Admin',passwordHash:hash,role:'ADMIN'}});
 await db.memberAccount.create({data:{id:seedId,
  email:'susp-seed-'+seedId.slice(0,8)+'@example.invalid',
  displayName:'Disposable BFS Seed',passwordHash:'fixture-not-login',status:'ACTIVE'}});
 child=spawn(process.execPath,['backend/dist/main.js'],{
  env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),
   REGISTRATION_ACCESS_PIN_ENABLED:'true',NISVARTHA_UAT_PIN_REGISTRATION:'false',
   MEMBER_PIN_AUTO_ACTIVATE_ENABLED:'true',MEMBER_PORTAL_ENABLED:'true',
   MEMBER_APPLICATIONS_ENABLED:'true',MEMBER_STAFF_REGISTRATION_ENABLED:'true',
   MATRIX_PLACEMENT_ENABLED:'true',MEMBER_COMPENSATION_ENABLED:'false',
   MEMBER_COMPENSATION_APPROVED:'false',
   MEMBER_TERMS_VERSION:'suspension-terms',MEMBER_PRIVACY_VERSION:'suspension-privacy'},
  detached:true,stdio:'ignore'
 });
 let ready=false;
 for(let attempt=0;attempt<100;attempt++){
  try{if((await fetch(api+'/health/ready')).ok){ready=true;break}}catch{}
  await new Promise(done=>setTimeout(done,150));
 }
 assert.ok(ready,'Compiled API failed to start');
 const login=await request('/staff/login','POST',{email:staffEmail,password:staffPassword});
 assert.equal(login.status,200,'Admin login failed');
 const token=login.data.accessToken;
 const root=await request('/cms/membership/root','POST',{
  ...signup(),applicantPresent:true
 },token);
 assert.equal(root.status,201,'Root creation failed: '+JSON.stringify(root.data));
 memberIds.push(root.data.id);
 const rootRow=await db.memberAccount.findUniqueOrThrow({where:{id:root.data.id}});
 const issue=await request('/cms/membership/registration-pins','POST',{
  requestKey:randomUUID(),quantity:3
 },token);
 assert.equal(issue.status,201,'E-PIN issue failed: '+JSON.stringify(issue.data));
 assert.equal(issue.data.expiresAt,null,'Fixture must use a real no-expiry E-PIN');
 batchIds.push(issue.data.batchId);
 const first=await request('/members/register','POST',
  signup(issue.data.codes[0],rootRow.referralCode));
 assert.equal(first.status,201,'Target member registration failed: '+JSON.stringify(first.data));
 memberIds.push(first.data.id);
 const targetPos=await db.matrixPosition.findUniqueOrThrow({
  where:{entryKey:'ORIGINAL:'+first.data.id}
 });
 assert.equal(targetPos.sequence,2);
 const decision='/cms/membership/applications/'+first.data.applicationReference+'/decide';
 const suspended=await request(decision,'POST',{
  status:'SUSPENDED',reason:'Pause member for level-four completion regression'
 },token);
 assert.equal(suspended.status,200,'Could not suspend target member');
 await seedThrough(201);
 const level4=await request('/members/register','POST',
  signup(issue.data.codes[1],rootRow.referralCode));
 assert.equal(level4.status,201,'Level-four completion failed: '+JSON.stringify(level4.data));
 memberIds.push(level4.data.id);
 assert.equal((await db.matrixPosition.findUniqueOrThrow({
  where:{entryKey:'ORIGINAL:'+level4.data.id}
 })).sequence,202,'Expected target level four to finish at sequence 202');
 const skipped=await db.matrixPosition.findUniqueOrThrow({where:{id:targetPos.id}});
 assert.ok(skipped.level4RebirthSkippedAt,'Suspended level-four skip was not persisted');
 assert.equal(await db.matrixPosition.count({where:{
  sourcePositionId:targetPos.id,kind:'REBIRTH'
 }}),0,'Suspended level-four minted a rebirth');
 assert.equal(await db.memberAudit.count({where:{
  memberId:first.data.id,action:'MATRIX_LEVEL_4_SKIPPED_SUSPENDED'
 }}),1,'Suspended level-four skip must be audited');
 const resumed=await request(decision,'POST',{
  status:'APPROVED',reason:'Reactivation after independently reviewed account pause'
 },token);
 assert.equal(resumed.status,200,'Reactivation failed: '+JSON.stringify(resumed.data));
 assert.equal(await db.matrixPosition.count({where:{
  sourcePositionId:targetPos.id,kind:'REBIRTH'
 }}),0,'Reactivation backfilled a forfeited rebirth');
 assert.equal(await db.matrixPosition.count({where:{
  memberId:first.data.id,kind:'ORIGINAL'
 }}),1,'Reactivation allocated a second original position');
 await seedThrough(606);
 const level5=await request('/members/register','POST',
  signup(issue.data.codes[2],rootRow.referralCode));
 assert.equal(level5.status,201,'Level-five after skipped level-four failed: '+JSON.stringify(level5.data));
 memberIds.push(level5.data.id);
 assert.equal((await db.matrixPosition.findUniqueOrThrow({
  where:{entryKey:'ORIGINAL:'+level5.data.id}
 })).sequence,607);
 const completed=await db.matrixPosition.findUniqueOrThrow({where:{id:targetPos.id}});
 assert.ok(completed.completedAt,'Level five failed to close the original position');
 assert.ok(completed.level4RebirthSkippedAt,'Closing the position lost the permanent skip marker');
 const rebirths=await db.matrixPosition.findMany({where:{
  sourcePositionId:targetPos.id,kind:'REBIRTH'
 }});
 assert.equal(rebirths.length,3,'Level five must create only its three eligible rebirths');
 assert.ok(rebirths.every(row=>row.triggerLevel===5),
  'A forfeited Level-4 rebirth was incorrectly backfilled');
 assert.equal(await db.memberEarning.count(),0,
  'Suspended nonfinancial matrix tests must not create payable earnings');
 console.log('Suspended L4 skip -> reactivation -> active L5: three rebirths, closure and audit: PASS');
}finally{
 if(child?.pid){
  const stopped=new Promise(resolve=>child.once('exit',resolve));
  try{process.kill(-child.pid,'SIGTERM')}catch{}
  await Promise.race([stopped,new Promise(resolve=>setTimeout(resolve,2500))]);
 }
 const max=(await db.matrixPosition.aggregate({_max:{sequence:true}}))._max.sequence??0;
 const tiers=[];let first=1,last=1;
 while(first<=max){tiers.push({first,last});first=last+1;last=last*3+1}
 for(const tier of tiers.reverse())
  await db.matrixPosition.deleteMany({where:{sequence:{gte:tier.first,lte:tier.last}}});
 if(max)await db.matrixState.update({where:{id:1},data:{nextSequence:1}});
 await db.memberInvitation.deleteMany({where:{OR:[
  {inviterId:{in:memberIds}},{inviteeId:{in:memberIds}}
 ]}});
 await db.registrationPin.deleteMany({where:{batchId:{in:batchIds}}});
 await db.registrationPinBatch.deleteMany({where:{id:{in:batchIds}}});
 await db.memberSession.deleteMany({where:{memberId:{in:memberIds}}});
 await db.memberAudit.deleteMany({where:{memberId:{in:memberIds}}});
 await db.membershipApplication.deleteMany({where:{memberId:{in:memberIds}}});
 await db.memberAccount.deleteMany({where:{id:{in:memberIds}}});
 await db.cmsAudit.deleteMany({where:{actorId:staffId}});
 await db.staffSession.deleteMany({where:{staffId}});
 await db.staffUser.deleteMany({where:{id:staffId}});
 await db.$disconnect();
}
