import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {createRequire} from 'node:module';

const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client'),argon2=require('argon2');
if(!process.env.DATABASE_URL||new URL(process.env.DATABASE_URL).pathname!=='/nisvartha_ci')
 throw Error('Q37 paid accounting smoke requires isolated disposable MySQL');
const db=new PrismaClient();
const port=await new Promise((resolve,reject)=>{
 const server=createServer();server.once('error',reject);
 server.listen(0,'127.0.0.1',()=>{
  const value=server.address();if(!value||typeof value==='string')
   return reject(Error('No TCP port'));
  server.close(()=>resolve(value.port));
 });
});
const origin='http://127.0.0.1:'+port+'/api/v1';
const staffId=randomUUID(),batchIds=[],paidRefs=[],refundIds=[];
const adminEmail='verified-paid-'+staffId.slice(0,8)+'@example.invalid';
const password='Verified-Paid-Batch-Synthetic-2026';
const request=async(path,method='GET',body,token)=>{
 const res=await fetch(origin+path,{method,headers:{
  ...(body?{'Content-Type':'application/json'}:{}),
  ...(token?{Authorization:'Bearer '+token}:{})
 },...(body?{body:JSON.stringify(body)}:{})});
 const raw=await res.text();let data;
 try{data=JSON.parse(raw)}catch{data=raw}
 return {status:res.status,data};
};
let child;
try{
 assert.equal(await db.registrationPinPaidBatch.count(),0,'Requires an empty paid ledger');
 const passwordHash=await argon2.hash(password,{
  type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
 await db.staffUser.create({data:{id:staffId,email:adminEmail,
  displayName:'Verified Paid CI Admin',passwordHash,role:'ADMIN'}});
 // Preexisting registration PINs have no verified paid receipt, by design.
 const legacyId=randomUUID(),legacyPinId=randomUUID();
 await db.registrationPinBatch.create({data:{
  id:legacyId,requestKey:randomUUID(),issuerId:staffId,quantity:1,expiresAt:null
 }});
 await db.registrationPin.create({data:{
  id:legacyPinId,batchId:legacyId,tokenHash:randomBytes(32).toString('hex'),
  displaySuffix:'LEGACY',sealedCode:null,expiresAt:null
 }});
 batchIds.push(legacyId);
 child=spawn(process.execPath,['backend/dist/main.js'],{
  env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),
   REGISTRATION_ACCESS_PIN_ENABLED:'true',NISVARTHA_UAT_PIN_REGISTRATION:'false',
   MEMBER_PORTAL_ENABLED:'true',MEMBER_APPLICATIONS_ENABLED:'true',
   MEMBER_STAFF_REGISTRATION_ENABLED:'true',
   PAID_PIN_ISSUANCE_ENABLED:'true',PAID_PIN_ACCOUNTING_APPROVED:'true',
   MEMBER_COMPENSATION_ENABLED:'false',MEMBER_COMPENSATION_APPROVED:'false',
   MEMBER_TERMS_VERSION:'paid-ci-terms',MEMBER_PRIVACY_VERSION:'paid-ci-privacy'},
  detached:true,stdio:'ignore'
 });
 let ready=false;
 for(let i=0;i<100;i++){
  try{if((await fetch(origin+'/health/ready')).ok){ready=true;break}}catch{}
  await new Promise(done=>setTimeout(done,150));
 }
 assert.ok(ready,'Compiled API failed readiness with test-only paid flags');
 const login=await request('/staff/login','POST',{email:adminEmail,password});
 assert.equal(login.status,200,'Admin login failed');
 const token=login.data.accessToken;
 const prefix='/cms/membership/registration-pins';
 const initial=await request(prefix+'/paid-summary','GET',undefined,token);
 assert.equal(initial.status,200);
 assert.equal(initial.data.grossPaidPaise,0,'Legacy issue must not create paid amounts');
 assert.equal(initial.data.paidPinCount,0,'Legacy PIN must not appear as paid');
 assert.equal((await request(prefix+'/paid-summary')).status,401,
  'Anonymous paid ledger access was allowed');
 const body={requestKey:randomUUID(),quantity:3,
  verifiedAmountPaise:4_500_000,paymentVerified:true,
  bankReference:'PAID_'+randomUUID().slice(0,12).toUpperCase(),
  evidenceRef:'PAYMENT_'+randomUUID().slice(0,12).toUpperCase(),
  receivedAt:new Date(Date.now()-90_000).toISOString()};
 assert.equal((await request(prefix,'POST',{
  requestKey:randomUUID(),quantity:1
 },token)).status,409,'Legacy PIN issue remains possible in verified paid mode');
 assert.equal((await request(prefix+'/verified-paid','POST',{
  ...body,verifiedAmountPaise:3_000_000
 },token)).status,400,'Wrong verified amount was accepted');
 assert.equal((await request(prefix+'/verified-paid','POST',{
  ...body,paymentVerified:false
 },token)).status,400,'Unverified offline payment was accepted');
 assert.equal((await request(prefix+'/verified-paid','POST',{
  ...body,receivedAt:new Date(Date.now()+3600_000).toISOString()
 },token)).status,400,'Future offline receipt was accepted');
 assert.equal((await request(prefix+'/verified-paid','POST',body)).status,401,
  'Anonymous paid E-PIN issue was allowed');
 const issue=await request(prefix+'/verified-paid','POST',body,token);
 assert.equal(issue.status,201,'Verified PIN issuance failed: '+JSON.stringify(issue.data));
 assert.equal(issue.data.accounting,'VERIFIED_PAID');
 assert.equal(issue.data.verifiedAmountPaise,4_500_000);
 assert.equal(issue.data.codes.length,3);
 batchIds.push(issue.data.batchId);paidRefs.push(body.bankReference);
 const receipt=await db.registrationPinPaidBatch.findUniqueOrThrow({
  where:{batchId:issue.data.batchId},include:{batch:true}
 });
 assert.equal(receipt.verifiedAmountPaise,3*1_500_000);
 assert.equal(receipt.unitAmountPaise,1_500_000);
 assert.equal(receipt.batch.quantity,3);
 assert.equal(receipt.bankReference,body.bankReference);
 const registered=await db.financialSettlementReference.findUniqueOrThrow({
  where:{reference:body.bankReference}
 });
 assert.equal(registered.sourceKind,'PIN_PAYMENT');
 assert.equal(registered.sourceId,issue.data.batchId);
 assert.equal((await request(prefix+'/verified-paid','POST',body,token)).status,409,
  'Replaying a paid issuance must not create a second batch');
 assert.equal((await request(prefix+'/verified-paid','POST',{
  ...body,requestKey:randomUUID()
 },token)).status,409,'The same offline bank reference was accepted twice');
 const summary=await request(prefix+'/paid-summary','GET',undefined,token);
 assert.equal(summary.data.verifiedBatchCount,1);
 assert.equal(summary.data.paidPinCount,3);
 assert.equal(summary.data.availablePaidPinCount,3);
 assert.equal(summary.data.grossPaidPaise,4_500_000);
 assert.equal(summary.data.netReceivedAfterRefundPaise,4_500_000);
 assert.equal(summary.data.refundPendingPaise,0);
 const paidRows=await request(prefix+'?accounting=VERIFIED_PAID','GET',undefined,token);
 assert.equal(paidRows.status,200);
 assert.equal(paidRows.data.matchingTotal,3);
 assert.equal(paidRows.data.items.length,3);
 assert.ok(paidRows.data.items.every(pin=>pin.accounting==='VERIFIED_PAID'&&
  pin.unitAmountPaise===1_500_000&&pin.paidBankReference===body.bankReference));
 const legacyRows=await request(prefix+'?accounting=LEGACY','GET',undefined,token);
 assert.equal(legacyRows.status,200);
 assert.ok(legacyRows.data.items.some(pin=>pin.id===legacyPinId&&
  pin.accounting==='LEGACY'&&pin.unitAmountPaise===null));
 const onePaid=paidRows.data.items[0];
 const cancel={requestKey:randomUUID(),reason:'Verified refund request after offline review'};
 const cancelDone=await request(prefix+'/'+onePaid.id+'/cancel','POST',cancel,token);
 assert.equal(cancelDone.status,200);
 const waiting=await request(prefix+'/paid-summary','GET',undefined,token);
 assert.equal(waiting.data.grossPaidPaise,4_500_000);
 assert.equal(waiting.data.refundPendingPaise,1_500_000);
 assert.equal(waiting.data.refundedPaise,0);
 assert.equal(waiting.data.netReceivedAfterRefundPaise,4_500_000,
  'Cancelling a PIN is not a completed refund');
 const refunded={requestKey:randomUUID(),
  bankReference:'REFUNDED_'+randomUUID().slice(0,12).toUpperCase(),
  evidenceRef:'OFFLINE_'+randomUUID().slice(0,12).toUpperCase(),
  paidAt:new Date().toISOString()};
 const payment=await request(prefix+'/'+onePaid.id+'/refund','POST',refunded,token);
 assert.equal(payment.status,200,'Evidence-backed refund failed: '+JSON.stringify(payment.data));
 refundIds.push(payment.data.refundId);
 const final=await request(prefix+'/paid-summary','GET',undefined,token);
 assert.equal(final.data.grossPaidPaise,4_500_000);
 assert.equal(final.data.refundPendingPaise,0);
 assert.equal(final.data.refundedPaise,1_500_000);
 assert.equal(final.data.netReceivedAfterRefundPaise,3_000_000);
 assert.equal(final.data.paidPinCount,3);
 assert.equal(final.data.refundedPinCount,1);
 // Q8-A: one cancelled unused paid bearer can be re-issued using its existing
 // receipt, with exactly one old/new link and no additional financial amount.
 const alternate=paidRows.data.items.find(p=>p.id!==onePaid.id);
 assert.ok(alternate,'Need a second paid PIN to test replacement');
 assert.equal((await request(prefix+'/'+legacyPinId+'/replace','POST',
  {requestKey:randomUUID()},token)).status,409,'Legacy PIN treated as paid');
 assert.equal((await request(prefix+'/'+onePaid.id+'/replace','POST',
  {requestKey:randomUUID()},token)).status,409,'Refunded PIN was replaceable');
 assert.equal((await request(prefix+'/'+alternate.id+'/replace','POST',
  {requestKey:randomUUID()})).status,401,'Anonymous replacement allowed');
 assert.equal((await request(prefix+'/'+alternate.id+'/replace','POST',
  {requestKey:randomUUID()},token)).status,409,'Available PIN was replaceable');
 const cancelled=await request(prefix+'/'+alternate.id+'/cancel','POST',
  {requestKey:randomUUID(),reason:'Reissue this unused verified paid registration code'},token);
 assert.equal(cancelled.status,200);
 const replacementKey=randomUUID();
 const replacement=await request(prefix+'/'+alternate.id+'/replace','POST',
  {requestKey:replacementKey},token);
 assert.equal(replacement.status,200,'Replacement failed '+JSON.stringify(replacement.data));
 assert.match(replacement.data.code,/^[A-Za-z0-9_-]{43}$/);
 assert.equal(replacement.data.paidAmountAddedPaise,0);
 assert.equal(replacement.data.alreadyIssued,false);
 const same=await request(prefix+'/'+alternate.id+'/replace','POST',
  {requestKey:replacementKey},token);
 assert.equal(same.status,200);
 assert.equal(same.data.code,replacement.data.code,'Idempotent replacement changed bearer');
 assert.equal(same.data.alreadyIssued,true);
 assert.equal((await request(prefix+'/'+alternate.id+'/replace','POST',
  {requestKey:randomUUID()},token)).status,409,'Second replacement was allowed');
 assert.equal((await request(prefix+'/'+alternate.id+'/refund','POST',{
  requestKey:randomUUID(),bankReference:'BLOCK_'+randomUUID().slice(0,12).toUpperCase(),
  evidenceRef:'REPLACED_NO_REFUND',paidAt:new Date().toISOString()
 },token)).status,409,'Original paid right was refunded after replacement');
 const link=await db.registrationPinReplacement.findUniqueOrThrow({
  where:{oldPinId:alternate.id},include:{newPin:true}
 });
 assert.equal(link.newPinId,replacement.data.pinId);
 assert.equal(link.newPin.batchId,issue.data.batchId,'Replacement lost original paid provenance');
 assert.equal(await db.registrationPinPaidBatch.count(),1,'Replacement minted a receipt');
 const replacedInventory=await request(prefix+'?status=REPLACED&accounting=VERIFIED_PAID',
  'GET',undefined,token);
 assert.equal(replacedInventory.status,200);
 assert.ok(replacedInventory.data.items.some(x=>x.id===alternate.id&&
  x.replacementPinId===replacement.data.pinId));
 const unchanged=await request(prefix+'/paid-summary','GET',undefined,token);
 assert.equal(unchanged.data.paidPinCount,3,'Replacement inflated receipt count');
 assert.equal(unchanged.data.availablePaidPinCount,2);
 assert.equal(unchanged.data.refundPendingPaise,0,
  'Already replaced code must not count as pending refund');
 assert.equal(unchanged.data.grossPaidPaise,4_500_000);
 assert.equal(unchanged.data.netReceivedAfterRefundPaise,3_000_000);
 assert.equal(await db.cmsAudit.count({where:{actorId:staffId,
  objectId:alternate.id,action:'REGISTRATION_PIN_REPLACED'}}),1);
 assert.equal(await db.memberEarning.count(),0,'Paid accounting minted a referral reward');
 assert.equal(await db.memberOfflineSale.count(),0,'Paid accounting fabricated a member sale');
 assert.equal(await db.cmsAudit.count({where:{
  actorId:staffId,action:'VERIFIED_PAID_PINS_ISSUED',
  objectId:issue.data.batchId
 }}),1,'Verified paid batch must have one durable Admin audit');
 console.log('Q37-A legacy exclusion, exact INR amount, Admin evidence, status filters, refund net and global reference: PASS');
}finally{
 if(child?.pid){
  const stopped=new Promise(resolve=>child.once('exit',resolve));
  try{process.kill(-child.pid,'SIGTERM')}catch{}
  await Promise.race([stopped,new Promise(resolve=>setTimeout(resolve,2000))]);
 }
 await db.financialSettlementReference.deleteMany({where:{
  OR:[{sourceKind:'PIN_PAYMENT',sourceId:{in:batchIds}},
      {sourceKind:'PIN_REFUND',sourceId:{in:refundIds}}]
 }});
 await db.registrationPinRefund.deleteMany({where:{pin:{batchId:{in:batchIds}}}});
 await db.registrationPinReplacement.deleteMany({where:{oldPin:{batchId:{in:batchIds}}}});
 await db.registrationPinPaidBatch.deleteMany({where:{batchId:{in:batchIds}}});
 await db.registrationPin.deleteMany({where:{batchId:{in:batchIds}}});
 await db.registrationPinBatch.deleteMany({where:{id:{in:batchIds}}});
 await db.cmsAudit.deleteMany({where:{actorId:staffId}});
 await db.staffSession.deleteMany({where:{staffId}});
 await db.staffUser.deleteMany({where:{id:staffId}});
 await db.$disconnect();
}
