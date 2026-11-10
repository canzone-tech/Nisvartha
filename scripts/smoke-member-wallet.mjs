import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';

const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const argon2=require('argon2');
if(!process.env.DATABASE_URL||new URL(process.env.DATABASE_URL).pathname!=='/nisvartha_ci')
 throw Error('M6 wallet smoke requires disposable CI MySQL only');
const db=new PrismaClient();
const port=await new Promise((resolve,reject)=>{
 const socket=createServer();socket.once('error',reject);
 socket.listen(0,'127.0.0.1',()=>{
  const value=socket.address();if(!value||typeof value==='string')return reject(Error('Port missing'));
  socket.close(()=>resolve(value.port));
 });
});
const api='http://127.0.0.1:'+port+'/api/v1';
const memberId=randomUUID(),adminId=randomUUID(),memberPass='M6-Wallet-Member-2026';
const adminPass='M6-Wallet-Admin-2026',referencePrefix='CI-'+memberId.slice(0,8).toUpperCase();
const earningIds=[randomUUID(),randomUUID(),randomUUID()];
let child;
async function call(path,method='GET',body,token){
 const response=await fetch(api+path,{method,headers:{
  ...(body?{'Content-Type':'application/json'}:{}),
  ...(token?{Authorization:'Bearer '+token}:{})
 },...(body?{body:JSON.stringify(body)}:{})});
 const text=await response.text();let data;
 try{data=JSON.parse(text)}catch{data=text}
 return {status:response.status,data};
}
try{
 const hash=await argon2.hash(memberPass,{type:argon2.argon2id,
  memoryCost:65536,timeCost:3,parallelism:1});
 const adminHash=await argon2.hash(adminPass,{type:argon2.argon2id,
  memoryCost:65536,timeCost:3,parallelism:1});
 await db.staffUser.create({data:{id:adminId,
  email:'wallet-admin-'+adminId.slice(0,8)+'@example.invalid',
  displayName:'Wallet Admin',passwordHash:adminHash,role:'ADMIN'}});
 const memberEmail='wallet-'+memberId.slice(0,8)+'@example.invalid';
 await db.memberAccount.create({data:{id:memberId,email:memberEmail,
  displayName:'Wallet CI Member',passwordHash:hash,status:'ACTIVE'}});
 await db.memberEarning.createMany({data:[
  {id:earningIds[0],earningKey:'WALLET:'+earningIds[0],kind:'MATRIX_LEVEL_1',
   level:1,beneficiaryMemberId:memberId,amountPaise:250_000},
  {id:earningIds[1],earningKey:'WALLET:'+earningIds[1],kind:'MATRIX_LEVEL_2',
   level:2,beneficiaryMemberId:memberId,amountPaise:500_000},
  {id:earningIds[2],earningKey:'WALLET:'+earningIds[2],kind:'DIRECT_REFERRAL',
   beneficiaryMemberId:memberId,amountPaise:100_000}
 ]});
 child=spawn(process.execPath,['backend/dist/main.js'],{
  env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),
   MEMBER_PORTAL_ENABLED:'true',MEMBER_APPLICATIONS_ENABLED:'true',
   REGISTRATION_ACCESS_PIN_ENABLED:'true',MATRIX_PLACEMENT_ENABLED:'true',
   MEMBER_COMPENSATION_ENABLED:'true',MEMBER_COMPENSATION_APPROVED:'true',
   MEMBER_WALLET_ENABLED:'true',MEMBER_PIN_AUTO_ACTIVATE_ENABLED:'false',
   NISVARTHA_UAT_PIN_REGISTRATION:'false',
   MEMBER_TERMS_VERSION:'wallet-ci-terms',MEMBER_PRIVACY_VERSION:'wallet-ci-privacy'},
  detached:true,stdio:'ignore'});
 let ready=false;
 for(let i=0;i<100;i++){
  try{if((await fetch(api+'/health/ready')).ok){ready=true;break}}catch{}
  await new Promise(resolve=>setTimeout(resolve,180));
 }
 assert.ok(ready,'Compiled wallet API did not start');
 const admin=await call('/staff/login','POST',{
  email:'wallet-admin-'+adminId.slice(0,8)+'@example.invalid',password:adminPass
 });
 assert.equal(admin.status,200,'Admin login failed');
 const member=await call('/members/login','POST',{email:memberEmail,password:memberPass});
 assert.equal(member.status,200,'Member login failed');
 const adminToken=admin.data.accessToken,memberToken=member.data.accessToken;
 assert.equal((await call('/members/wallet')).status,401,'Anonymous wallet access was allowed');
 assert.equal((await call('/cms/membership/payouts')).status,401,'Anonymous Admin payouts exposed');
 let wallet=await call('/members/wallet','GET',undefined,memberToken);
 assert.equal(wallet.status,200,'Wallet summary unavailable');
 assert.equal(wallet.data.wallet.availablePaise,850_000);
 assert.equal(wallet.data.wallet.paidPaise,0);
 assert.equal(wallet.data.canRequest,true);
 const initial={requestKey:randomUUID(),amountPaise:600_000};
 const requested=await call('/members/wallet/payouts','POST',initial,memberToken);
 assert.equal(requested.status,201,'Payout reservation failed: '+JSON.stringify(requested.data));
 const replay=await call('/members/wallet/payouts','POST',initial,memberToken);
 assert.equal(replay.status,201,'Retry must be idempotent');
 assert.equal(replay.data.id,requested.data.id);
 assert.equal((await call('/members/wallet/payouts','POST',
  {...initial,amountPaise:200_000},memberToken)).status,409,
  'Idempotency key must reject changed amounts');
 const races=await Promise.all([
  call('/members/wallet/payouts','POST',{requestKey:randomUUID(),amountPaise:250_000},memberToken),
  call('/members/wallet/payouts','POST',{requestKey:randomUUID(),amountPaise:300_000},memberToken)
 ]);
 assert.deepEqual(races.map(x=>x.status).sort((a,b)=>a-b),[201,409],
  'Concurrent payout requests must not over-reserve');
 const secondary=races.find(x=>x.status===201).data;
 wallet=await call('/members/wallet','GET',undefined,memberToken);
 assert.equal(wallet.data.wallet.availablePaise,0);
 assert.equal(wallet.data.wallet.reservedPaise,850_000);
 const pending=await call('/cms/membership/payouts','GET',undefined,adminToken);
 assert.equal(pending.status,200);
 assert.equal(pending.data.filter(x=>x.member.id===memberId).length,2);
 // Verified Admin pending-payout decisions remain available during suspension.
 await db.memberAccount.update({where:{id:memberId},data:{status:'SUSPENDED'}});
 const suspendedQueue=await call('/cms/membership/payouts','GET',undefined,adminToken);
 assert.equal(suspendedQueue.status,200,'Suspension blocked Admin payout review');
 assert.equal(suspendedQueue.data.filter(x=>x.member.id===memberId).length,2,
  'Suspension incorrectly removed existing pending reservations');
 const now=new Date(Date.now()-20_000).toISOString();
 const legacy=await call('/cms/membership/earnings/'+earningIds[0]+'/settle','POST',{
  requestKey:randomUUID(),settlementReference:referencePrefix+'-LEGACY',
  evidenceRef:'EVID_LEGACY_'+memberId.slice(0,8).toUpperCase(),settledAt:now
 },adminToken);
 assert.equal(legacy.status,409,'Legacy earning settlement must not bypass reserved wallet');
 const firstPayment={status:'PAID',decisionRequestKey:randomUUID(),
  settlementReference:referencePrefix+'-PAY',
  settlementEvidenceRef:'EVID_PAY_'+memberId.slice(0,8).toUpperCase(),paidAt:now};
 const paid=await call('/cms/membership/payouts/'+requested.data.id+'/decide',
  'POST',firstPayment,adminToken);
 assert.equal(paid.status,200,'Admin paid-record failed: '+JSON.stringify(paid.data));
 assert.equal(paid.data.status,'PAID');
 assert.equal((await call('/cms/membership/payouts/'+requested.data.id+'/decide',
  'POST',firstPayment,adminToken)).status,200,'Decision replay must be idempotent');
 assert.equal((await call('/cms/membership/payouts/'+requested.data.id+'/decide',
  'POST',{...firstPayment,decisionRequestKey:randomUUID()},adminToken)).status,409,
  'Conflicting payout decision must not duplicate payment');
 const reject={status:'REJECTED',decisionRequestKey:randomUUID(),
  rejectionReason:'Member requested cancellation'};
 const rejected=await call('/cms/membership/payouts/'+secondary.id+'/decide','POST',reject,adminToken);
 assert.equal(rejected.status,200,'Rejection failed');
 assert.equal((await call('/cms/membership/payouts/'+secondary.id+'/decide',
  'POST',reject,adminToken)).status,200,'Rejection replay must be idempotent');
 await db.memberAccount.update({where:{id:memberId},data:{status:'ACTIVE'}});
 wallet=await call('/members/wallet','GET',undefined,memberToken);
 assert.equal(wallet.status,200);
 assert.equal(wallet.data.wallet.availablePaise,250_000,'Rejected reservation must be released');
 assert.equal(wallet.data.wallet.reservedPaise,0);
 assert.equal(wallet.data.wallet.paidPaise,600_000);
 assert.equal((await db.financialSettlementReference.findUniqueOrThrow({
  where:{reference:firstPayment.settlementReference}
 })).sourceKind,'PAYOUT','Unique external transfer evidence was not recorded');
 assert.equal(await db.memberPayoutRequest.count({where:{memberId}}),2);
 // No Admin history entry may disappear beyond the old 100-row hard cap.
 // Build 127 authoritative requests and walk every bounded keyset page.
 const oldPayouts=await db.memberPayoutRequest.count({where:{memberId}});
 assert.equal(oldPayouts,2);
 await db.memberPayoutRequest.createMany({data:Array.from({length:125},()=>({
  id:randomUUID(),memberId,requestKey:randomUUID(),amountPaise:1,
  status:'REQUESTED'
 }))});
 let cursor=null;
 const seen=new Set();
 for(let round=0;round<12;round++){
  const query='/cms/membership/payouts/page?status=ALL&limit=25'+
   (cursor?'&cursor='+encodeURIComponent(cursor):'');
  const page=await call(query,'GET',undefined,adminToken);
  assert.equal(page.status,200,'Admin payout page unavailable: '+JSON.stringify(page.data));
  assert.equal(page.data.matchingTotal,127,'Payout history total must not be truncated');
  assert.ok(page.data.items.length<=25,'Payout page exceeded requested size');
  for(const row of page.data.items){
   assert.ok(!seen.has(row.id),'Duplicate payout on successive pages');
   seen.add(row.id);
  }
  if(page.data.nextCursor===null)break;
  assert.equal(page.data.nextCursor,page.data.items.at(-1).id);
  cursor=page.data.nextCursor;
 }
 assert.equal(seen.size,127,'Some paid/pending/rejected payout records were skipped');
 for(const [status,expected] of [['PAID',1],['REJECTED',1],['REQUESTED',125]]){
  const filtered=await call('/cms/membership/payouts/page?status='+status+'&limit=25',
   'GET',undefined,adminToken);
  assert.equal(filtered.status,200,'Payout filter failed for '+status);
  assert.equal(filtered.data.matchingTotal,expected,'Payout filter count mismatch for '+status);
  assert.ok(filtered.data.items.every(row=>row.status===status));
 }
 const denied=await call('/cms/membership/payouts/page?status=ALL&limit=25');
 assert.equal(denied.status,401,'Anonymous payout history was exposed');
 const badCursor=await call('/cms/membership/payouts/page?status=PAID&limit=25&cursor='+
  requested.data.id,'GET',undefined,adminToken);
 assert.equal(badCursor.status,200,'Valid paid cursor must remain usable');
 const invalidCursor=await call('/cms/membership/payouts/page?status=REJECTED&limit=25&cursor='+
  requested.data.id,'GET',undefined,adminToken);
 assert.equal(invalidCursor.status,400,'Foreign-status pagination cursor should be rejected');
 console.log('M6 Admin payout table: filtered, >100 rows, stable pages and RBAC: PASS');

 assert.ok(await db.memberAudit.count({where:{memberId,action:'WALLET_PAYOUT_REQUESTED'}})>=2);
 assert.ok(await db.cmsAudit.count({where:{actorId:adminId,action:'MEMBER_PAYOUT_RECORDED'}})>=1);
 console.log('M6 real-MySQL wallet: available/reserved/paid, replay, concurrency, legacy settlement isolation, external evidence and rejection: PASS');
}finally{
 if(child?.pid){
  const exited=new Promise(resolve=>child.once('exit',resolve));
  try{process.kill(-child.pid,'SIGTERM')}catch{}
  await Promise.race([exited,new Promise(resolve=>setTimeout(resolve,2500))]);
 }
 const payouts=await db.memberPayoutRequest.findMany({where:{memberId},select:{id:true}});
 await db.financialSettlementReference.deleteMany({where:{sourceId:{in:[
  ...payouts.map(x=>x.id),...earningIds]}}});
 await db.memberPayoutRequest.deleteMany({where:{memberId}});
 await db.memberEarning.deleteMany({where:{beneficiaryMemberId:memberId}});
 await db.memberSession.deleteMany({where:{memberId}});
 await db.memberAudit.deleteMany({where:{memberId}});
 await db.memberAccount.deleteMany({where:{id:memberId}});
 await db.cmsAudit.deleteMany({where:{actorId:adminId}});
 await db.staffSession.deleteMany({where:{staffId:adminId}});
 await db.staffUser.deleteMany({where:{id:adminId}});
 await db.$disconnect();
}
