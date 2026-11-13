import assert from 'node:assert/strict';
import {randomUUID,randomInt} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {createRequire} from 'node:module';

const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client'),argon2=require('argon2');
if(!process.env.DATABASE_URL||new URL(process.env.DATABASE_URL).pathname!=='/nisvartha_ci')
 throw Error('Paid registration integration smoke requires isolated disposable MySQL');
const db=new PrismaClient();
const port=await new Promise((resolve,reject)=>{
 const server=createServer();server.once('error',reject);
 server.listen(0,'127.0.0.1',()=>{
  const address=server.address();
  if(!address||typeof address==='string')return reject(Error('No TCP port'));
  server.close(()=>resolve(address.port));
 });
});
const origin='http://127.0.0.1:'+port+'/api/v1';
const staffId=randomUUID(),suffix=staffId.slice(0,8).toUpperCase();
const password='Paid-Allocation-Finance-CI-Password-2026';
const memberPassword='123456';
const email='paid-integration-'+suffix.toLowerCase()+'@example.invalid';
const memberIds=[],batchIds=[],bankRefs=[];
let child;
async function request(path,method='GET',body,token){
 const res=await fetch(origin+path,{method,headers:{
  ...(body?{'Content-Type':'application/json'}:{}),
  ...(token?{Authorization:'Bearer '+token}:{})
 },...(body?{body:JSON.stringify(body)}:{})});
 const raw=await res.text();let data;
 try{data=JSON.parse(raw)}catch{data=raw}
 return {status:res.status,data};
}
const signup=(pin,invite)=>({
 email:'paid-member-'+randomUUID().slice(0,9)+'@example.invalid',
 mobile:'+91'+randomInt(1_000_000_000,10_000_000_000),
 displayName:'Paid Receipt Integration CI',password:memberPassword,
 ...(pin?{registrationPin:pin}:{}),...(invite?{inviteCode:invite}:{}),
 termsVersion:'paid-integration-terms',privacyVersion:'paid-integration-privacy',
 consent:true,communicationOptIn:false
});
try{
 assert.equal(await db.matrixPosition.count(),0,'Requires isolated empty matrix');
 assert.equal(await db.registrationPinPaidBatch.count(),0,'Requires empty verified paid receipts');
 const hash=await argon2.hash(password,{
  type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1
 });
 await db.staffUser.create({data:{id:staffId,email,displayName:'Paid Integration CI Admin',
  passwordHash:hash,role:'ADMIN'}});
 child=spawn(process.execPath,['backend/dist/main.js'],{
  env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),
   REGISTRATION_ACCESS_PIN_ENABLED:'true',NISVARTHA_UAT_PIN_REGISTRATION:'false',
   MEMBER_PORTAL_ENABLED:'true',MEMBER_APPLICATIONS_ENABLED:'true',
   MEMBER_STAFF_REGISTRATION_ENABLED:'true',MEMBER_PUBLIC_REGISTRATION_ENABLED:'true',MATRIX_PLACEMENT_ENABLED:'true',
   MEMBER_PIN_AUTO_ACTIVATE_ENABLED:'true',MEMBER_WALLET_ENABLED:'true',
   MEMBER_COMPENSATION_ENABLED:'true',MEMBER_COMPENSATION_APPROVED:'true',
   PAID_PIN_ISSUANCE_ENABLED:'true',PAID_PIN_ACCOUNTING_APPROVED:'true',
   MEMBER_TERMS_VERSION:'paid-integration-terms',
   MEMBER_PRIVACY_VERSION:'paid-integration-privacy'},
  detached:true,stdio:'ignore'
 });
 let ready=false;
 for(let i=0;i<100;i++){
  try{if((await fetch(origin+'/health/ready')).ok){ready=true;break}}catch{}
  await new Promise(done=>setTimeout(done,150));
 }
 assert.ok(ready,'Compiled paid registration API readiness failed');
 const login=await request('/staff/login','POST',{email,password});
 assert.equal(login.status,200,'Admin login failed');
 const token=login.data.accessToken;
 const root=await request('/cms/membership/root','POST',{
  ...signup(),applicantPresent:true
 },token);
 assert.equal(root.status,201,'Root setup failed '+JSON.stringify(root.data));
 memberIds.push(root.data.id);
 const rootAccount=await db.memberAccount.findUniqueOrThrow({where:{id:root.data.id}});
 assert.equal(rootAccount.status,'ACTIVE');
 const receipt={
  requestKey:randomUUID(),quantity:1,paymentVerified:true,
  verifiedAmountPaise:1_500_000,bankReference:'PAIDFLOW_'+suffix,
  evidenceRef:'PAID_EVID_'+suffix,
  receivedAt:new Date(Date.now()-60_000).toISOString()
 };
 const issue=await request('/cms/membership/registration-pins/verified-paid','POST',receipt,token);
 assert.equal(issue.status,201,'Verified paid E-PIN issue failed '+JSON.stringify(issue.data));
 assert.equal(issue.data.codes.length,1);
 batchIds.push(issue.data.batchId);bankRefs.push(receipt.bankReference);
 const account=signup(issue.data.codes[0],rootAccount.referralCode);
 const member=await request('/members/register','POST',account);
 assert.equal(member.status,201,'Paid active registration failed '+JSON.stringify(member.data));
 assert.equal(member.data.status,'APPROVED','Paid E-PIN should activate without a second review');
 memberIds.push(member.data.id);
 const consumed=await db.registrationPin.findFirstOrThrow({
  where:{redeemedByMemberId:member.data.id}
 });
 const attribution=await db.registrationPinPaidRedemption.findUniqueOrThrow({
  where:{memberId:member.data.id}
 });
 assert.equal(attribution.pinId,consumed.id);
 assert.equal(attribution.amountPaise,1_500_000);
 assert.equal(consumed.batchId,issue.data.batchId,'Paid right lost receipt provenance');
 assert.equal(await db.memberOfflineSale.count(),0,
  'Joining payment was incorrectly counted as a separate offline sale');
 const direct=await db.memberEarning.findUniqueOrThrow({
  where:{earningKey:'DIRECT:'+member.data.id}});
 assert.equal(direct.kind,'DIRECT_REFERRAL');
 assert.equal(direct.amountPaise,100_000,
  'Verified paid registration must atomically credit the eligible inviter');
 assert.equal(direct.beneficiaryMemberId,rootAccount.id);
 assert.equal(await db.memberEarning.count(),1,'Exactly one referral earning expected');
 const after=await request('/cms/membership/registration-pins/paid-summary',
  'GET',undefined,token);
 assert.equal(after.status,200);
 assert.equal(after.data.grossPaidPaise,1_500_000);
 assert.equal(after.data.verifiedMemberAllocations,1);
 assert.equal(after.data.allocatedRegistrationPaise,1_500_000);
 assert.equal(after.data.reconciliationOk,true);
 assert.equal((await request('/members/register','POST',{
  ...account,email:'retry-'+suffix.toLowerCase()+'@example.invalid'
 })).status,400,'Used PIN created a second member');
 const secondReference=await request(
  '/cms/membership/members/'+member.data.id+'/sale','POST',{
   transactionRequestKey:randomUUID(),transactionReference:'SECOND_'+suffix,
   transactionEvidenceRef:'OTHER_RECEIPT_'+suffix,
   transactionReceivedAt:new Date(Date.now()-30_000).toISOString()
  },token);
 assert.equal(secondReference.status,409,
  'Same paid right was accepted again as a new joining sale');
 const rootLogin=await request('/members/login','POST',{
  identifier:rootAccount.referralCode,password:memberPassword
 });
 assert.equal(rootLogin.status,200);
 const rootToken=rootLogin.data.accessToken;
 const wallet=await request('/members/wallet','GET',undefined,rootToken);
 assert.equal(wallet.status,200);
 assert.equal(wallet.data.wallet.availablePaise,100_000,
  'Only verified direct referral should be credited, never the entire joining fee');
 const profile=await request('/members/wallet/payment-profile','PATCH',{
  defaultMethod:'UPI',upiId:'paid.fixture@okbank'
 },rootToken);
 assert.equal(profile.status,200);
 assert.equal((await request('/members/wallet/payouts','POST',{
  requestKey:randomUUID(),amountPaise:100_001
 },rootToken)).status,409,'Payout exceeding funded direct referral was accepted');
 assert.equal(await db.registrationPinPaidRedemption.count(),1,
  'One paid E-PIN must produce exactly one authoritative member allocation');
 console.log('Verified paid receipt -> single-use E-PIN -> ACTIVE member -> immutable plan -> exactly-once funded referral -> wallet: PASS');
}finally{
 if(child?.pid){
  const stopped=new Promise(resolve=>child.once('exit',resolve));
  try{process.kill(-child.pid,'SIGTERM')}catch{}
  await Promise.race([stopped,new Promise(resolve=>setTimeout(resolve,2500))]);
 }
 await db.registrationPinPaidRedemption.deleteMany({where:{memberId:{in:memberIds}}});
 await db.memberPayoutRequest.deleteMany({where:{memberId:{in:memberIds}}});
 await db.memberPayoutProfile.deleteMany({where:{memberId:{in:memberIds}}});
 await db.memberOfflineSale.deleteMany({where:{memberId:{in:memberIds}}});
 await db.memberEarning.deleteMany({where:{beneficiaryMemberId:{in:memberIds}}});
 const positions=await db.matrixPosition.findMany({
  where:{memberId:{in:memberIds}},select:{id:true},orderBy:{sequence:'desc'}
 });
 for(const position of positions)await db.matrixPosition.delete({where:{id:position.id}});
 if(positions.length)await db.matrixState.update({where:{id:1},data:{nextSequence:1}});
 await db.memberInvitation.deleteMany({where:{OR:[
  {inviterId:{in:memberIds}},{inviteeId:{in:memberIds}}
 ]}});
 await db.memberSession.deleteMany({where:{memberId:{in:memberIds}}});
 await db.memberAudit.deleteMany({where:{memberId:{in:memberIds}}});
 await db.membershipApplication.deleteMany({where:{memberId:{in:memberIds}}});
 await db.registrationPin.deleteMany({where:{batchId:{in:batchIds}}});
 await db.registrationPinPaidBatch.deleteMany({where:{batchId:{in:batchIds}}});
 await db.registrationPinBatch.deleteMany({where:{id:{in:batchIds}}});
 await db.memberAccount.deleteMany({where:{id:{in:memberIds}}});
 await db.financialSettlementReference.deleteMany({where:{reference:{in:bankRefs}}});
 await db.cmsAudit.deleteMany({where:{actorId:staffId}});
 await db.staffSession.deleteMany({where:{staffId}});
 await db.staffUser.deleteMany({where:{id:staffId}});
 await db.$disconnect();
}
