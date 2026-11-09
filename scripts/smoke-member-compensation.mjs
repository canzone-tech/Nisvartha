import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';

const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const argon2=require('argon2');
const db=new PrismaClient();
if(!process.env.DATABASE_URL||new URL(process.env.DATABASE_URL).pathname!=='/nisvartha_ci')
 throw Error('Offline member earnings smoke requires isolated CI MySQL only');

const port=await new Promise((done,reject)=>{
 const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{
  const a=s.address();if(!a||typeof a==='string')return reject(Error('Port unavailable'));
  s.close(()=>done(a.port));
 });
});
const api='http://127.0.0.1:'+port+'/api/v1';
const sid=randomUUID(),password='Offline-Earnings-Admin-2026';
const memberPassword='Offline-Member-Activation-2026';
const adminEmail='earnings-admin-'+sid.slice(0,8)+'@example.invalid';
const batchIds=[],realMemberIds=[],seedMemberIds=[];
let child,adminToken,rootId,rootToken;

const request=async(path,method='GET',body,token)=>{
 const response=await fetch(api+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),
  ...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const text=await response.text();let data;try{data=JSON.parse(text)}catch{data=text}
 return {status:response.status,data};
};
const signup=(pin,inviteCode)=>({
 email:'earn-'+randomUUID().slice(0,8)+'@example.invalid',
 displayName:'Offline Earnings Member',password:memberPassword,
 registrationPin:pin,...(inviteCode?{inviteCode}:{}),
 termsVersion:'offline-terms-v1',privacyVersion:'offline-privacy-v1',
 consent:true,communicationOptIn:false
});
const transaction=(tag)=>({
 transactionRequestKey:randomUUID(),
 transactionReference:'SALE/'+tag+'/'+randomUUID().slice(0,8),
 transactionEvidenceRef:'EVID_'+tag.toUpperCase()+'_'+randomUUID().slice(0,8).toUpperCase(),
 transactionReceivedAt:new Date(Date.now()-60_000).toISOString()
});
async function approve(applicationReference,tag){
 const base='/cms/membership/applications/'+applicationReference;
 assert.equal((await request(base+'/review','POST',{},adminToken)).status,200,'Review failed '+tag);
 const activation=transaction(tag);
 const result=await request(base+'/decide','POST',{
  status:'APPROVED',reason:'Offline sale verified for earnings smoke',...activation
 },adminToken);
 assert.equal(result.status,200,'Approval failed '+tag+': '+JSON.stringify(result.data));
 return activation;
}
async function registerAndApprove(pin,tag,inviteCode,staffAssisted=false){
 const input=signup(pin,inviteCode);
 const body=staffAssisted?{...input,applicantPresent:true}:input;
 const endpoint=staffAssisted?'/cms/membership/applications/register':'/members/register';
 const created=await request(endpoint,'POST',body,staffAssisted?adminToken:undefined);
 assert.equal(created.status,201,'Registration failed '+tag+': '+JSON.stringify(created.data));
 realMemberIds.push(created.data.id);
 const activation=await approve(created.data.applicationReference,tag);
 return {id:created.data.id,input,applicationReference:created.data.applicationReference,activation};
}
async function seedThrough(endSequence){
 const state=await db.matrixState.findUniqueOrThrow({where:{id:1}});
 const start=state.nextSequence;
 assert.ok(start<=endSequence+1,'Matrix seed start is ahead of requested end');
 if(start>endSequence)return;
 const existing=await db.matrixPosition.findMany({select:{id:true,sequence:true}});
 const bySequence=new Map(existing.map(x=>[x.sequence,x.id]));
 for(let sequence=start;sequence<=endSequence;sequence++){
  const memberId=randomUUID(),positionId=randomUUID();
  seedMemberIds.push(memberId);
  await db.memberAccount.create({data:{
   id:memberId,email:'seed-'+sequence+'-'+memberId.slice(0,6)+'@example.invalid',
   displayName:'Seed Position '+sequence,passwordHash:'seed-not-login',status:'ACTIVE'
  }});
  const parentSequence=Math.floor((sequence-2)/3)+1;
  const parentId=bySequence.get(parentSequence);
  assert.ok(parentId,'Missing seed parent for sequence '+sequence);
  const slot=((sequence-2)%3)+1;
  await db.matrixPosition.create({data:{id:positionId,sequence,entryKey:'SEED:'+sequence+':'+memberId,
   memberId,parentId,slot,kind:'ORIGINAL'}});
  bySequence.set(sequence,positionId);
 }
 await db.matrixState.update({where:{id:1},data:{nextSequence:endSequence+1}});
}

try{
 assert.equal(await db.matrixPosition.count(),0,'Compensation smoke requires empty matrix fixture');
 assert.equal((await db.matrixState.findUniqueOrThrow({where:{id:1}})).nextSequence,1);
 const hash=await argon2.hash(password,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
 await db.staffUser.create({data:{id:sid,email:adminEmail,displayName:'Offline Earnings Admin',
  passwordHash:hash,role:'ADMIN'}});

 child=spawn(process.execPath,['backend/dist/main.js'],{
  env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),
   REGISTRATION_ACCESS_PIN_ENABLED:'true',NISVARTHA_UAT_PIN_REGISTRATION:'false',
   MEMBER_PORTAL_ENABLED:'true',MEMBER_APPLICATIONS_ENABLED:'true',
   MEMBER_STAFF_REGISTRATION_ENABLED:'true',MATRIX_PLACEMENT_ENABLED:'true',
   MEMBER_COMPENSATION_ENABLED:'true',MEMBER_COMPENSATION_APPROVED:'true',
   MEMBER_TERMS_VERSION:'offline-terms-v1',MEMBER_PRIVACY_VERSION:'offline-privacy-v1'},
  stdio:'ignore',detached:true
 });
 let ready=false;
 for(let i=0;i<80;i++){
  try{if((await fetch(api+'/health/ready')).ok){ready=true;break}}catch{}
  await new Promise(done=>setTimeout(done,200));
 }
 assert.ok(ready,'Compiled API did not become ready');

 const login=await request('/staff/login','POST',{email:adminEmail,password});
 assert.equal(login.status,200);adminToken=login.data.accessToken;
 const pins=await request('/cms/membership/registration-pins','POST',{
  requestKey:randomUUID(),quantity:8,expiresAt:'2099-12-31T23:59:00+05:30'
 },adminToken);
 assert.equal(pins.status,201,'E-PIN issuance failed: '+JSON.stringify(pins.data));
 batchIds.push(pins.data.batchId);
 const [p1,p2,p3,p4,p13,p40,p121,p364]=pins.data.codes;

 const root=await registerAndApprove(p1,'ROOT');
 rootId=root.id;
 const rootAccount=await db.memberAccount.findUniqueOrThrow({where:{id:rootId}});
 assert.equal((await db.memberOfflineSale.findUniqueOrThrow({where:{memberId:rootId}})).amountPaise,1_500_000);
 const rootPosition=await db.matrixPosition.findFirstOrThrow({where:{memberId:rootId,kind:'ORIGINAL'}});
 assert.equal(rootPosition.sequence,1);

 const rootLogin=await request('/members/login','POST',{email:root.input.email,password:memberPassword});
 assert.equal(rootLogin.status,200);rootToken=rootLogin.data.accessToken;
 const directMember=await registerAndApprove(p2,'DIRECT',rootAccount.referralCode);
 assert.equal(directMember.id.length,36);
 const replay=await request('/cms/membership/applications/'+directMember.applicationReference+'/decide','POST',{
  status:'APPROVED',reason:'Offline sale verified for earnings smoke',...directMember.activation
 },adminToken);
 assert.equal(replay.status,200,'Lost-response approval replay was not idempotent');
 assert.equal(await db.memberOfflineSale.count({where:{memberId:directMember.id}}),1);
 assert.equal(await db.memberEarning.count({where:{earningKey:'DIRECT:'+directMember.id}}),1);
 assert.equal(await db.matrixPosition.count({where:{memberId:directMember.id,kind:'ORIGINAL'}}),1);
 await registerAndApprove(p3,'L1-B');
 await registerAndApprove(p4,'L1-C');
 let rootEarnings=await db.memberEarning.findMany({where:{beneficiaryMemberId:rootId}});
 assert.equal(rootEarnings.find(x=>x.kind==='DIRECT_REFERRAL')?.amountPaise,100_000);
 assert.equal(rootEarnings.find(x=>x.kind==='MATRIX_LEVEL_1'&&x.sourcePositionId===rootPosition.id)?.amountPaise,250_000);
 await assert.rejects(()=>db.memberEarning.create({data:{
  id:randomUUID(),earningKey:'INVALID-AMOUNT:'+randomUUID(),
  kind:'DIRECT_REFERRAL',beneficiaryMemberId:rootId,sourceMemberId:directMember.id,
  amountPaise:99_999
 }}),'Database must reject a direct earning with an invalid amount');

 await seedThrough(12);
 await registerAndApprove(p13,'LEVEL2');
 assert.equal((await db.memberEarning.findUnique({where:{earningKey:'MATRIX:'+rootPosition.id+':L2'}}))?.amountPaise,500_000);

 await seedThrough(39);
 await registerAndApprove(p40,'LEVEL3',undefined,true);
 assert.equal((await db.memberEarning.findUnique({where:{earningKey:'MATRIX:'+rootPosition.id+':L3'}}))?.amountPaise,1_000_000);

 await seedThrough(120);
 await registerAndApprove(p121,'LEVEL4',undefined,true);
 assert.equal((await db.memberEarning.findUnique({where:{earningKey:'MATRIX:'+rootPosition.id+':L4'}}))?.amountPaise,5_000_000);
 let rootRebirth=await db.matrixPosition.findMany({where:{sourcePositionId:rootPosition.id,kind:'REBIRTH'},orderBy:{sequence:'asc'}});
 assert.deepEqual(rootRebirth.map(x=>[x.triggerLevel,x.rebirthOrdinal]),[[4,1]],
  'Level 4 must auto-fill one rebirth ID into next available position');
 assert.equal(rootRebirth[0].sequence,122);

 await seedThrough(363);
 await registerAndApprove(p364,'LEVEL5',undefined,true);
 const originalLevels=await db.memberEarning.findMany({where:{
  beneficiaryMemberId:rootId,sourcePositionId:rootPosition.id
 }});
 assert.deepEqual(new Map(originalLevels.map(x=>[x.kind,x.amountPaise])),new Map([
  ['MATRIX_LEVEL_1',250_000],['MATRIX_LEVEL_2',500_000],['MATRIX_LEVEL_3',1_000_000],
  ['MATRIX_LEVEL_4',5_000_000],['MATRIX_LEVEL_5',9_000_000]
 ]),'Original matrix cycle level amounts do not match flyer');
 assert.equal(originalLevels.reduce((sum,x)=>sum+x.amountPaise,0),15_750_000,
  'Completed ID must total ₹1,57,500 matrix earnings');
 rootRebirth=await db.matrixPosition.findMany({where:{sourcePositionId:rootPosition.id,kind:'REBIRTH'},orderBy:{sequence:'asc'}});
 assert.deepEqual(rootRebirth.map(x=>x.triggerLevel),[4,5,5,5],
  'Completed original ID must generate one level-4 and three level-5 rebirth IDs');
 assert.equal((await db.matrixPosition.findUniqueOrThrow({where:{id:rootPosition.id}})).completedAt instanceof Date,true);

 const memberMatrix=await request('/members/matrix','GET',undefined,rootToken);
 assert.equal(memberMatrix.status,200);
 assert.equal(memberMatrix.data.rebirthPositions.filter(x=>x.sourceSequence===1).length,4);
 const memberEarnings=await request('/members/earnings','GET',undefined,rootToken);
 assert.equal(memberEarnings.status,200);
 assert.equal(memberEarnings.data.sale.amountPaise,1_500_000);
 assert.ok(memberEarnings.data.totalPaise>=15_850_000,'Root must include direct + full original matrix earnings');

 const direct=await db.memberEarning.findUniqueOrThrow({where:{earningKey:'DIRECT:'+realMemberIds[1]}});
 const settledAt=new Date(Date.now()-10_000).toISOString();
 const directSettlement={requestKey:randomUUID(),settlementReference:'UPI/'+randomUUID().slice(0,12),
  evidenceRef:'SETTLE_'+randomUUID().slice(0,12).toUpperCase(),settledAt};
 const settle=await request('/cms/membership/earnings/'+direct.id+'/settle','POST',directSettlement,adminToken);
 assert.equal(settle.status,200,'Offline settlement failed: '+JSON.stringify(settle.data));
 assert.equal(settle.data.status,'SETTLED');
 const replay=await request('/cms/membership/earnings/'+direct.id+'/settle','POST',directSettlement,adminToken);
 assert.equal(replay.status,200,'Exact settlement replay must be idempotent');
 const level1=await db.memberEarning.findUniqueOrThrow({where:{earningKey:'MATRIX:'+rootPosition.id+':L1'}});
 const duplicateReference=await request('/cms/membership/earnings/'+level1.id+'/settle','POST',{
  requestKey:randomUUID(),settlementReference:directSettlement.settlementReference,
  evidenceRef:'SETTLE_DUP_'+randomUUID().slice(0,8).toUpperCase(),settledAt
 },adminToken);
 assert.equal(duplicateReference.status,409,'External settlement reference reuse must be rejected');
 const level2=await db.memberEarning.findUniqueOrThrow({where:{earningKey:'MATRIX:'+rootPosition.id+':L2'}});
 const concurrentAt=new Date(Date.now()-5_000).toISOString();
 const settlementAttempts=[1,2].map(n=>({
  requestKey:randomUUID(),settlementReference:'UPI/CONCURRENT-'+n+'-'+randomUUID().slice(0,8),
  evidenceRef:'SETTLE_CONCURRENT_'+n+'_'+randomUUID().slice(0,6).toUpperCase(),settledAt:concurrentAt
 }));
 const concurrentResults=await Promise.all(settlementAttempts.map(input=>
  request('/cms/membership/earnings/'+level2.id+'/settle','POST',input,adminToken)));
 assert.deepEqual(concurrentResults.map(x=>x.status).sort(),[200,409],
  'Concurrent settlement attempts must produce one success and one conflict');
 const winningIndex=concurrentResults.findIndex(x=>x.status===200);
 assert.ok(winningIndex>=0);
 const winningReplay=await request('/cms/membership/earnings/'+level2.id+'/settle','POST',
  settlementAttempts[winningIndex],adminToken);
 assert.equal(winningReplay.status,200,'Winning concurrent settlement must remain replay-idempotent');
 assert.equal(await db.memberEarning.count({where:{id:level2.id,status:'SETTLED'}}),1);
 const after=await request('/members/earnings','GET',undefined,rootToken);
 assert.equal(after.data.summary.settledPaise>=100_000,true);
 assert.equal(after.data.earnings.find(x=>x.id===direct.id)?.status,'SETTLED');

 const adminView=await request('/cms/membership/earnings/'+rootId,'GET',undefined,adminToken);
 assert.equal(adminView.status,200);
 assert.equal(adminView.data.sale.evidenceRef.startsWith('EVID_'),true);
 console.log('Offline ₹15,000 activation, ₹1,000 direct earning, five matrix levels, 4 rebirth IDs, unique/idempotent/concurrent settlement: PASS');
}finally{
 if(child?.pid){
  const done=new Promise(resolve=>child.once('exit',resolve));
  try{process.kill(-child.pid,'SIGTERM')}catch{}
  await Promise.race([done,new Promise(resolve=>setTimeout(resolve,2500))]);
 }
 const all=[...realMemberIds,...seedMemberIds];
 if(all.length){
  await db.memberEarning.deleteMany({where:{OR:[
   {beneficiaryMemberId:{in:all}},{sourceMemberId:{in:all}}
  ]}});
  await db.memberOfflineSale.deleteMany({where:{memberId:{in:all}}});
 }
 if(batchIds.length){
  await db.registrationPin.deleteMany({where:{batchId:{in:batchIds}}});
  await db.registrationPinBatch.deleteMany({where:{id:{in:batchIds}}});
 }
 if(all.length){
  const positions=await db.matrixPosition.findMany({where:{memberId:{in:all}},orderBy:{sequence:'desc'},select:{id:true}});
  for(const row of positions)await db.matrixPosition.delete({where:{id:row.id}});
  await db.matrixState.update({where:{id:1},data:{nextSequence:1}});
  await db.memberInvitation.deleteMany({where:{OR:[{inviterId:{in:all}},{inviteeId:{in:all}}]}});
  await db.membershipApplication.deleteMany({where:{memberId:{in:all}}});
  await db.memberSession.deleteMany({where:{memberId:{in:all}}});
  await db.memberAudit.deleteMany({where:{memberId:{in:all}}});
  await db.memberAccount.deleteMany({where:{id:{in:all}}});
 }
 await db.cmsAudit.deleteMany({where:{actorId:sid}});
 await db.staffSession.deleteMany({where:{staffId:sid}});
 await db.staffUser.deleteMany({where:{id:sid}});
 await db.$disconnect();
}
