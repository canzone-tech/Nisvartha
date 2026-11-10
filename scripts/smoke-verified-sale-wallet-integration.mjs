import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {randomUUID,randomInt} from 'node:crypto';
import {createRequire} from 'node:module';

const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const argon2=require('argon2');

if(!process.env.DATABASE_URL||new URL(process.env.DATABASE_URL).pathname!=='/nisvartha_ci')
 throw Error('M7 integrated registration-to-wallet test requires disposable CI MySQL');
const db=new PrismaClient();
const port=await new Promise((resolve,reject)=>{
 const server=createServer();server.once('error',reject);
 server.listen(0,'127.0.0.1',()=>{
  const address=server.address();
  if(!address||typeof address==='string')return reject(Error('No free API port'));
  server.close(()=>resolve(address.port));
 });
});
const api='http://127.0.0.1:'+port+'/api/v1';
const staffId=randomUUID(),testSuffix=staffId.slice(0,8),adminPassword='M7-Integration-Admin-2026';
const memberPassword='M7-Integration-Member-2026';
const staffEmail='m7-admin-'+testSuffix+'@example.invalid';
const memberIds=[],batchIds=[];
let child;

async function request(path,method='GET',body,token){
 const response=await fetch(api+path,{method,headers:{
  ...(body?{'Content-Type':'application/json'}:{}),
  ...(token?{Authorization:'Bearer '+token}:{})
 },...(body?{body:JSON.stringify(body)}:{})});
 const raw=await response.text();let data;
 try{data=JSON.parse(raw)}catch{data=raw}
 return {status:response.status,data};
}
const signup=(pin,inviter)=>({
 email:'m7-'+randomUUID().slice(0,9)+'@example.invalid',
 mobile:'+91'+randomInt(1_000_000_000,10_000_000_000),
 displayName:'M7 Verified Sale Member',password:memberPassword,
 ...(pin?{registrationPin:pin}:{}),...(inviter?{inviteCode:inviter}:{}),
 termsVersion:'m7-test-terms',privacyVersion:'m7-test-privacy',
 consent:true,communicationOptIn:false
});
try{
 assert.equal(await db.matrixPosition.count(),0,'M7 financial simulation needs empty matrix');
 const hash=await argon2.hash(adminPassword,{
  type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
 await db.staffUser.create({data:{id:staffId,email:staffEmail,
  displayName:'M7 Integration Admin',passwordHash:hash,role:'ADMIN'}});
 child=spawn(process.execPath,['backend/dist/main.js'],{
  env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),
   REGISTRATION_ACCESS_PIN_ENABLED:'true',NISVARTHA_UAT_PIN_REGISTRATION:'false',
   MEMBER_PORTAL_ENABLED:'true',MEMBER_APPLICATIONS_ENABLED:'true',
   MEMBER_STAFF_REGISTRATION_ENABLED:'true',MATRIX_PLACEMENT_ENABLED:'true',
   MEMBER_PIN_AUTO_ACTIVATE_ENABLED:'true',MEMBER_WALLET_ENABLED:'true',
   MEMBER_COMPENSATION_ENABLED:'true',MEMBER_COMPENSATION_APPROVED:'true',
   MEMBER_TERMS_VERSION:'m7-test-terms',MEMBER_PRIVACY_VERSION:'m7-test-privacy'},
  detached:true,stdio:'ignore'});
 let ready=false;
 for(let i=0;i<100;i++){
  try{if((await fetch(api+'/health/ready')).ok){ready=true;break}}catch{}
  await new Promise(resolve=>setTimeout(resolve,150));
 }
 assert.ok(ready,'M7 compiled API readiness failed');
 const admin=await request('/staff/login','POST',{email:staffEmail,password:adminPassword});
 assert.equal(admin.status,200,'Admin login failed');
 const adminToken=admin.data.accessToken;
 const root=await request('/cms/membership/root','POST',{
  ...signup(),applicantPresent:true
 },adminToken);
 assert.equal(root.status,201,'Admin root creation failed: '+JSON.stringify(root.data));
 assert.equal(root.data.status,'APPROVED');
 memberIds.push(root.data.id);
 const rootAccount=await db.memberAccount.findUniqueOrThrow({where:{id:root.data.id}});
 assert.equal(rootAccount.status,'ACTIVE');
 assert.match(rootAccount.referralCode,/^[A-Z0-9]{8}$/);
 const issued=await request('/cms/membership/registration-pins','POST',{
  requestKey:randomUUID(),quantity:3,expiresAt:'2099-12-31T23:59:00+05:30'
 },adminToken);
 assert.equal(issued.status,201,'E-PIN issuance failed');
 batchIds.push(issued.data.batchId);
 const applicant=signup(issued.data.codes[0],rootAccount.referralCode);
 const member=await request('/members/register','POST',applicant);
 assert.equal(member.status,201,'Immediate registration failed: '+JSON.stringify(member.data));
 assert.equal(member.data.status,'APPROVED','Valid E-PIN must activate without review');
 memberIds.push(member.data.id);
 const account=await db.memberAccount.findUniqueOrThrow({where:{id:member.data.id}});
 assert.equal(account.status,'ACTIVE');
 assert.equal((await db.matrixPosition.findUniqueOrThrow({
  where:{entryKey:'ORIGINAL:'+member.data.id}
 })).sequence,2,'Member must be placed exactly once at the global next slot');
 assert.equal((await db.memberInvitation.findUniqueOrThrow({
  where:{inviteeId:member.data.id}
 })).inviterId,root.data.id);
 // Complete Level 1 using additional E-PIN-activated members whose transactions
 // are deliberately still unverified. A matrix slot is NOT funding evidence.
 for(const pin of issued.data.codes.slice(1)){
  const added=await request('/members/register','POST',
   signup(pin,rootAccount.referralCode));
  assert.equal(added.status,201,'Additional Level 1 placement failed');
  memberIds.push(added.data.id);
 }
 assert.equal(await db.matrixPosition.count({where:{kind:'ORIGINAL'}}),4);
 const rootPosition=await db.matrixPosition.findUniqueOrThrow({
  where:{entryKey:'ORIGINAL:'+root.data.id}
 });
 assert.equal(await db.memberEarning.count({where:{
  earningKey:'MATRIX:'+rootPosition.id+':L1'
 }}),0,'A financially unverified Level 1 cannot become a payable earning');
 const candidates=await request('/cms/membership/applications/page?limit=25',
  'GET',undefined,adminToken);
 assert.equal(candidates.status,200);
 assert.equal(candidates.data.items.find(x=>x.member.id===member.data.id)?.canRecordSale,true,
  'Admin must be able to record evidence for the unpaid active invitee');
 assert.equal(candidates.data.items.find(x=>x.member.id===root.data.id)?.canRecordSale,false,
  'Root cannot be presented as a redeemed paid E-PIN member');
 assert.equal(await db.memberOfflineSale.count({where:{memberId:member.data.id}}),0,
  'Admin E-PIN must not fabricate a joining transaction');
 assert.equal(await db.memberEarning.count(),0,
  'Joining by itself must not fabricate commission or matrix-level liability');
 const rootLogin=await request('/members/login','POST',{
  identifier:rootAccount.referralCode,password:memberPassword
 });
 assert.equal(rootLogin.status,200,'Root referral-code login failed');
 const rootToken=rootLogin.data.accessToken;
 const savedUpi=await request('/members/wallet/payment-profile','PATCH',{
  defaultMethod:'UPI',upiId:'root.member@okbank'
 },rootToken);
 assert.equal(savedUpi.status,200,'Could not save default UPI destination');
 assert.equal(savedUpi.data.defaultMethod,'UPI');
 let wallet=await request('/members/wallet','GET',undefined,rootToken);
 assert.equal(wallet.status,200);
 assert.equal(wallet.data.wallet.availablePaise,0);
 assert.equal((await request('/members/wallet/payouts','POST',
  {requestKey:randomUUID(),amountPaise:100_000},rootToken)).status,409,
  'Funds must not become available before verified payment');
 const evidence={
  transactionRequestKey:randomUUID(),
  transactionReference:'M7SALE/'+testSuffix.toUpperCase(),
  transactionEvidenceRef:'EVID_M7SALE_'+testSuffix.toUpperCase(),
  transactionReceivedAt:new Date(Date.now()-90_000).toISOString()
 };
 const salePath='/cms/membership/members/'+member.data.id+'/sale';
 assert.equal((await request(salePath,'POST',evidence)).status,401,
  'Anonymous payment evidence must not be accepted');
 const confirmed=await request(salePath,'POST',evidence,adminToken);
 assert.equal(confirmed.status,200,'Verified sale recording failed: '+JSON.stringify(confirmed.data));
 assert.equal(confirmed.data.amountPaise,1_500_000);
 assert.equal((await request(salePath,'POST',evidence,adminToken)).status,200,
  'Exact lost-response replay must be idempotent');
 assert.equal((await request(salePath,'POST',{
  ...evidence,transactionRequestKey:randomUUID()
 },adminToken)).status,409,'Changed settlement evidence must be rejected');
 assert.equal(await db.memberOfflineSale.count({where:{memberId:member.data.id}}),1);
 const refreshed=await request('/cms/membership/applications/page?limit=25',
  'GET',undefined,adminToken);
 assert.equal(refreshed.data.items.find(x=>x.member.id===member.data.id)?.canRecordSale,false,
  'Admin must hide duplicate receipt action after payment is recorded');
 assert.equal(await db.matrixPosition.count({where:{entryKey:'ORIGINAL:'+member.data.id}}),1,
  'Finance recording must not duplicate existing matrix position');
 const invited=await db.memberEarning.findUniqueOrThrow({
  where:{earningKey:'DIRECT:'+member.data.id}
 });
 assert.equal(invited.beneficiaryMemberId,root.data.id);
 assert.equal(invited.amountPaise,100_000);
 assert.equal(await db.memberEarning.count(),1,'Direct earning must be credited once');
 wallet=await request('/members/wallet','GET',undefined,rootToken);
 assert.equal(wallet.status,200);
 assert.equal(wallet.data.wallet.availablePaise,100_000,'Verified commission must reach wallet once');
 // No arbitrary minimum: a one-paisa reservation must work and Admin
 // rejection must restore it before the original payout runs.
 const onePaisa=await request('/members/wallet/payouts','POST',{
  requestKey:randomUUID(),amountPaise:1
 },rootToken);
 assert.equal(onePaisa.status,201,'One-paisa payout was rejected by an artificial minimum');
 assert.equal(onePaisa.data.payoutMethod,'UPI','Payout must snapshot Member default UPI');
 const originalUpi=await request('/cms/membership/payouts/'+onePaisa.data.id+
  '/payment-details','GET',undefined,adminToken);
 assert.equal(originalUpi.status,200,'Admin protected UPI access failed');
 assert.equal(originalUpi.data.destination.upiId,'root.member@okbank');
 const onePaisaRejected=await request('/cms/membership/payouts/'+onePaisa.data.id+'/decide',
  'POST',{status:'REJECTED',decisionRequestKey:randomUUID(),
   rejectionReason:'CI proof that minimum positive paise is allowed'},adminToken);
 assert.equal(onePaisaRejected.status,200,'Admin one-paisa rejection failed');
 const availableAgain=await request('/members/wallet','GET',undefined,rootToken);
 assert.equal(availableAgain.data.wallet.availablePaise,100_000,
  'One-paisa rejection did not restore available balance');
 const payoutRequest={requestKey:randomUUID(),amountPaise:100_000};
 const payout=await request('/members/wallet/payouts','POST',payoutRequest,rootToken);
 assert.equal(payout.status,201,'Payout reservation failed: '+JSON.stringify(payout.data));
 assert.equal((await request('/members/wallet/payouts','POST',
  {requestKey:randomUUID(),amountPaise:100_000},rootToken)).status,409,
  'Concurrent reservations must not spend the same referral earning twice');
 const paid=await request('/cms/membership/payouts/'+payout.data.id+'/decide','POST',{
  status:'PAID',decisionRequestKey:randomUUID(),
  settlementReference:'M7PAYOUT/'+testSuffix.toUpperCase(),
  settlementEvidenceRef:'EVID_M7PAY_'+testSuffix.toUpperCase(),
  paidAt:new Date(Date.now()-10_000).toISOString()
 },adminToken);
 assert.equal(paid.status,200,'Admin payout evidence failed: '+JSON.stringify(paid.data));
 wallet=await request('/members/wallet','GET',undefined,rootToken);
 assert.equal(wallet.data.wallet.availablePaise,0);
 assert.equal(wallet.data.wallet.reservedPaise,0);
 assert.equal(wallet.data.wallet.paidPaise,100_000);
 assert.equal(await db.memberAudit.count({where:{
  memberId:member.data.id,action:'OFFLINE_SALE_CONFIRMED'
 }}),1,'Verified sale must have one audit event');
 assert.ok(await db.cmsAudit.count({where:{
  actorId:staffId,action:'MEMBER_OFFLINE_SALE_CONFIRMED'
 }})===1,'Staff must have one auditable payment confirmation');
 console.log('M7 integration: Admin root -> E-PIN ACTIVE -> BFS/referral -> verified offline sale -> exactly-once DIRECT -> wallet reservation -> recorded payout: PASS');
}finally{
 if(child?.pid){
  const exited=new Promise(resolve=>child.once('exit',resolve));
  try{process.kill(-child.pid,'SIGTERM')}catch{}
  await Promise.race([exited,new Promise(resolve=>setTimeout(resolve,2500))]);
 }
 const payouts=await db.memberPayoutRequest.findMany({
  where:{memberId:{in:memberIds}},select:{id:true}
 });
 const earned=await db.memberEarning.findMany({
  where:{beneficiaryMemberId:{in:memberIds}},select:{id:true}
 });
 await db.financialSettlementReference.deleteMany({
  where:{sourceId:{in:[...payouts.map(x=>x.id),...earned.map(x=>x.id)]}}
 });
 await db.memberPayoutRequest.deleteMany({where:{memberId:{in:memberIds}}});
 await db.memberEarning.deleteMany({where:{beneficiaryMemberId:{in:memberIds}}});
 await db.memberOfflineSale.deleteMany({where:{memberId:{in:memberIds}}});
 const matrix=await db.matrixPosition.findMany({where:{memberId:{in:memberIds}},
  select:{id:true},orderBy:{sequence:'desc'}});
 for(const item of matrix)await db.matrixPosition.delete({where:{id:item.id}});
 if(matrix.length)await db.matrixState.update({where:{id:1},data:{nextSequence:1}});
 await db.memberInvitation.deleteMany({where:{OR:[
  {inviterId:{in:memberIds}},{inviteeId:{in:memberIds}}
 ]}});
 await db.registrationPin.deleteMany({where:{batchId:{in:batchIds}}});
 await db.registrationPinBatch.deleteMany({where:{id:{in:batchIds}}});
 await db.memberSession.deleteMany({where:{memberId:{in:memberIds}}});
 await db.memberAudit.deleteMany({where:{memberId:{in:memberIds}}});
 await db.membershipApplication.deleteMany({where:{memberId:{in:memberIds}}});
 await db.memberPayoutProfile.deleteMany({where:{memberId:{in:memberIds}}});
 await db.memberAccount.deleteMany({where:{id:{in:memberIds}}});
 await db.cmsAudit.deleteMany({where:{actorId:staffId}});
 await db.staffSession.deleteMany({where:{staffId}});
 await db.staffUser.deleteMany({where:{id:staffId}});
 await db.$disconnect();
}
