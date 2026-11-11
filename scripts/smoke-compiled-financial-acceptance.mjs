/** Real compiled Next.js + compiled Nest API acceptance smoke on disposable MySQL only.
 * Proof that public/admin UIs, receipt-backed registration, referral, level
 * earning, wallet, and financial rules are enabled in the SAME release.
 * Never execute against an actual member database.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomInt,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {validateClientAcceptanceArtifact} from './release-profile.mjs';

const root=resolve(process.argv[2]||'dist/fullstack');
const release=JSON.parse(readFileSync(join(root,'RELEASE_INFO.json'),'utf8'));
if(process.env.NISVARTHA_RELEASE_CHANNEL!=='client-acceptance'||
   release.release_channel!=='client-acceptance')
 throw Error('Compiled finance acceptance smoke requires the exact client-acceptance channel');
assert.deepEqual(validateClientAcceptanceArtifact(release),[]);
if(!process.env.DATABASE_URL||new URL(process.env.DATABASE_URL).pathname!=='/nisvartha_ci')
 throw Error('Compiled finance smoke MUST use disposable nisvartha_ci');
const requireApi=createRequire(join(root,'api/package.json'));
const {PrismaClient}=requireApi('@prisma/client'),argon2=requireApi('argon2');
const db=new PrismaClient();
const id=randomUUID(),suffix=id.slice(0,8).toUpperCase();
const email='compiled-finance-'+suffix.toLowerCase()+'@example.invalid';
const password='Finance-Compiled-CI-Admin-2026';
const memberPassword='Finance-Compiled-CI-Member-2026';
const batchRefs=[],batchIds=[],memberIds=[],processes=[];
let financialVersionId=null;
const freePort=()=>new Promise((done,reject)=>{
 const server=createServer();server.once('error',reject);
 server.listen(0,'127.0.0.1',()=>{
  const a=server.address();
  if(!a||typeof a==='string')return reject(Error('No free port'));
  server.close(()=>done(a.port));
 });
});
const apiPort=await freePort(),webPort=await freePort();
const base='http://127.0.0.1:'+webPort;
const api='http://127.0.0.1:'+apiPort;
const env={...process.env,NODE_ENV:'production',HOSTNAME:'127.0.0.1'};
function boot(file,cwd,extra){
 const child=spawn(process.execPath,[file],{
  cwd,env:{...env,...extra},stdio:'ignore',detached:true
 });
 processes.push(child);return child;
}
async function ready(path,child){
 for(let i=0;i<90;i++){
  if(child.exitCode!==null)throw Error('Compiled process exited: '+path);
  try{const res=await fetch(path,{signal:AbortSignal.timeout(1000)});
   if(res.status===200)return}catch{}
  await new Promise(done=>setTimeout(done,150));
 }
 throw Error('Compiled process not ready: '+path);
}
async function request(path,method='GET',body,cookie){
 const response=await fetch(base+path,{
  method,headers:{
   ...(body?{'Content-Type':'application/json',Origin:base}:{}),
   ...(cookie?{Cookie:cookie}: {})
  },
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const data=await response.json().catch(()=>null);
 return {status:response.status,data,headers:response.headers};
}
const signup=(address)=>({
 email:address,mobile:'+91'+randomInt(1_000_000_000,10_000_000_000),
 displayName:'Compiled Finance Member',password:memberPassword,
 termsVersion:release.build_env.MEMBER_TERMS_VERSION,
 privacyVersion:release.build_env.MEMBER_PRIVACY_VERSION,
 consent:true,communicationOptIn:false
});
try{
 assert.equal(await db.matrixPosition.count(),0,'Compiled finance smoke requires empty CI matrix');
 assert.equal(await db.memberEarning.count(),0,'Compiled finance smoke requires empty earning ledger');
 const hash=await argon2.hash(password,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
 await db.staffUser.create({data:{
  id,email,displayName:'Compiled Financial Acceptance Admin',
  role:'ADMIN',mustChangePassword:false,passwordHash:hash
 }});
 const apiProc=boot(join(root,'api/dist/main.js'),join(root,'api'),{
  HOST:'127.0.0.1',PORT:String(apiPort)
 });
 await ready(api+'/api/v1/health/ready',apiProc);
 const webProc=boot(join(root,'web/server.js'),join(root,'web'),{
  PORT:String(webPort),API_INTERNAL_URL:api
 });
 await ready(base+'/admin/login',webProc);

 assert.equal((await request('/api/admin/backend/cms/membership/financial-plan')).status,401,
  'Financial plans must never be public');
 const login=await request('/api/admin/session/login','POST',{email,password});
 assert.equal(login.status,200,'Compiled finance Admin login unavailable');
 const staffCookie=(login.headers.get('set-cookie')||'').split(';')[0];
 assert.match(staffCookie,/^nisvartha_staff_access=/);
 const rules=await request('/api/admin/backend/cms/membership/financial-plan','GET',undefined,staffCookie);
 assert.equal(rules.status,200,'Admin financial plan API disabled');
 assert.equal(rules.data.activeVersionId,1);
 assert.equal(rules.data.versions[0].joiningAmountPaise,1_500_000);
 const ui=await fetch(base+'/admin/business-rules',{headers:{Cookie:staffCookie}});
 assert.equal(ui.status,200,'Admin financial configuration page not deployed');
 assert.match(await ui.text(),/Business rules/i);
 const rootInput={...signup('compiled-root-'+suffix.toLowerCase()+'@example.invalid'),
  applicantPresent:true};
 const first=await request('/api/admin/backend/cms/membership/root','POST',rootInput,staffCookie);
 assert.equal(first.status,201,'Compiled root member setup failed: '+JSON.stringify(first.data));
 memberIds.push(first.data.id);
 const rootAccount=await db.memberAccount.findUniqueOrThrow({where:{id:first.data.id}});
 assert.equal(rootAccount.financialPlanVersionId,1);
 const receipt={
  requestKey:randomUUID(),quantity:3,paymentVerified:true,
  verifiedAmountPaise:4_500_000,
  bankReference:'CI_PAID_'+suffix,
  evidenceRef:'CI_RECEIPT_'+suffix,
  receivedAt:new Date(Date.now()-60_000).toISOString()
 };
 // No actual bank receipt is created; this test uses a disposable CI DB.
 const noEvidence=await request('/api/admin/backend/cms/membership/registration-pins/verified-paid',
  'POST',{...receipt,requestKey:randomUUID(),paymentVerified:false},staffCookie);
 assert.equal(noEvidence.status,400,'Issuance without asserted receipt verification accepted');
 const issue=await request('/api/admin/backend/cms/membership/registration-pins/verified-paid',
  'POST',receipt,staffCookie);
 assert.equal(issue.status,201,'Full-feature Admin paid E-PIN form/API not enabled: '+JSON.stringify(issue.data));
 assert.equal(issue.data.accounting,'VERIFIED_PAID');
 assert.equal(issue.data.codes.length,3);
 batchIds.push(issue.data.batchId);batchRefs.push(receipt.bankReference);
 for(let i=0;i<3;i++){
  const signupBody={...signup('compiled-child-'+suffix.toLowerCase()+'-'+i+'@example.invalid'),
   inviteCode:rootAccount.referralCode,registrationPin:issue.data.codes[i]};
  const child=await request('/api/member/session/register','POST',signupBody);
  assert.equal(child.status,201,'Compiled paid member registration failed: '+JSON.stringify(child.data));
  assert.equal(child.data.status,'APPROVED');
  memberIds.push(child.data.id);
  const paid=await db.registrationPinPaidRedemption.findUniqueOrThrow({where:{memberId:child.data.id}});
  assert.equal(paid.amountPaise,1_500_000);
  const direct=await db.memberEarning.findUniqueOrThrow({
   where:{earningKey:'DIRECT:'+child.data.id}});
  assert.equal(direct.amountPaise,100_000);
  assert.equal(direct.beneficiaryMemberId,rootAccount.id);
  assert.equal(direct.financialPlanVersionId,1);
 }
 // A subsequent Admin plan publication may change future paid PIN amounts,
 // but may not change an existing member's earnings or previous PIN batches.
 const published=await request('/api/admin/backend/cms/membership/financial-plan/publish',
  'POST',{requestKey:randomUUID(),expectedVersionId:1,
   reason:'CI verifies future effective financial plan snapshots',
   joiningAmountPaise:1_600_000,directReferralPaise:110_000,
   level1Paise:260_000,level2Paise:510_000,level3Paise:1_010_000,
   level4Paise:5_010_000,level5Paise:9_010_000,
   rebirthAtLevel4:1,rebirthAtLevel5:3},staffCookie);
 assert.equal(published.status,201,
  'Compiled Admin financial plan publication failed '+JSON.stringify(published.data));
 financialVersionId=published.data.id;
 const nextReceipt={...receipt,requestKey:randomUUID(),quantity:1,
  bankReference:'CI_SECOND_'+suffix,evidenceRef:'CI_SECOND_PROOF_'+suffix,
  verifiedAmountPaise:1_600_000};
 const second=await request('/api/admin/backend/cms/membership/registration-pins/verified-paid',
  'POST',nextReceipt,staffCookie);
 assert.equal(second.status,201,'New paid PIN must use newly published joining price');
 batchIds.push(second.data.batchId);batchRefs.push(nextReceipt.bankReference);
 const next=await request('/api/member/session/register','POST',{
  ...signup('compiled-next-'+suffix.toLowerCase()+'@example.invalid'),
  inviteCode:rootAccount.referralCode,registrationPin:second.data.codes[0]
 });
 assert.equal(next.status,201,'Previously issued and newly issued PIN prices must coexist');
 memberIds.push(next.data.id);
 const newMember=await db.memberAccount.findUniqueOrThrow({where:{id:next.data.id}});
 assert.equal(newMember.financialPlanVersionId,financialVersionId);
 assert.equal((await db.memberAccount.findUniqueOrThrow({where:{id:rootAccount.id}}))
  .financialPlanVersionId,1,'Publishing changed existing member entitlement policy');
 const fourthDirect=await db.memberEarning.findUniqueOrThrow({where:{earningKey:'DIRECT:'+next.data.id}});
 assert.equal(fourthDirect.amountPaise,100_000,'Prior inviter keeps old referral amount');
 assert.equal(fourthDirect.financialPlanVersionId,1);
 const level=await db.memberEarning.findFirstOrThrow({where:{
  beneficiaryMemberId:rootAccount.id,kind:'MATRIX_LEVEL_1'}});
 assert.equal(level.amountPaise,250_000,'Three paid members must complete level 1');
 assert.equal(level.financialPlanVersionId,1);
 const matrix=await request('/api/admin/backend/cms/membership/matrix/'+rootAccount.id,
  'GET',undefined,staffCookie);
 assert.equal(matrix.status,200);
 assert.equal(matrix.data.levels[0].filled,3);
 assert.equal(matrix.data.canCredit,true);
 const summary=await request('/api/admin/backend/cms/membership/registration-pins/paid-summary',
  'GET',undefined,staffCookie);
 assert.equal(summary.status,200);
 assert.equal(summary.data.grossPaidPaise,6_100_000);
 assert.equal(summary.data.paidPinCount,4);
 assert.equal(summary.data.verifiedMemberAllocations,4);
 assert.equal(summary.data.unitAmountPaise,1_600_000);
 assert.equal(summary.data.reconciliationOk,true);
 const rootLogin=await request('/api/member/session/login','POST',{
  identifier:rootAccount.referralCode,password:memberPassword
 });
 assert.equal(rootLogin.status,200);
 const memberCookie=(rootLogin.headers.get('set-cookie')||'').split(';')[0];
 assert.match(memberCookie,/^nisvartha_member_access=/);
 const profile=await request('/api/member/actions/payout-profile','POST',{
  defaultMethod:'UPI',upiId:'compiled.financial@okbank'
 },memberCookie);
 assert.equal(profile.status,200,'Compiled member payout profile unavailable');
 const payout=await request('/api/member/actions/payout','POST',{
  requestKey:randomUUID(),amountPaise:100_000
 },memberCookie);
 assert.equal(payout.status,201,'Real earning-based payout reservation disabled: '+JSON.stringify(payout.data));
 const history=await request('/api/admin/backend/cms/membership/payouts/page?status=REQUESTED&limit=25',
  'GET',undefined,staffCookie);
 assert.equal(history.status,200);
 assert.equal(history.data.matchingTotal,1,'Admin must see reserved payout');
 console.log('Compiled client-acceptance: Admin immutable policy, old/new paid prices, 4 active members, frozen referral+L1, wallet and payout, RBAC: PASS');
}finally{
 for(const child of processes){
  if(!child.pid)continue;
  const stopped=new Promise(done=>child.once('exit',done));
  try{process.kill(-child.pid,'SIGTERM')}catch{}
  await Promise.race([stopped,new Promise(done=>setTimeout(done,2500))]);
  if(child.exitCode===null)try{process.kill(-child.pid,'SIGKILL')}catch{}
 }
 if(memberIds.length){
  await db.memberPayoutRequest.deleteMany({where:{memberId:{in:memberIds}}});
  await db.memberPayoutProfile.deleteMany({where:{memberId:{in:memberIds}}});
  await db.memberEarning.deleteMany({where:{beneficiaryMemberId:{in:memberIds}}});
  await db.registrationPinPaidRedemption.deleteMany({where:{memberId:{in:memberIds}}});
  await db.memberSession.deleteMany({where:{memberId:{in:memberIds}}});
  await db.memberAudit.deleteMany({where:{memberId:{in:memberIds}}});
  const positions=await db.matrixPosition.findMany({where:{memberId:{in:memberIds}},
   select:{id:true},orderBy:{sequence:'desc'}});
  for(const item of positions)await db.matrixPosition.delete({where:{id:item.id}});
  await db.memberInvitation.deleteMany({where:{OR:[
   {inviterId:{in:memberIds}},{inviteeId:{in:memberIds}}
  ]}});
  await db.matrixState.update({where:{id:1},data:{nextSequence:1}});
 }
 if(batchIds.length){
  await db.registrationPin.deleteMany({where:{batchId:{in:batchIds}}});
  await db.registrationPinPaidBatch.deleteMany({where:{batchId:{in:batchIds}}});
  await db.registrationPinBatch.deleteMany({where:{id:{in:batchIds}}});
 }
 if(memberIds.length){
  await db.membershipApplication.deleteMany({where:{memberId:{in:memberIds}}});
  await db.memberAccount.deleteMany({where:{id:{in:memberIds}}});
 }
 await db.financialSettlementReference.deleteMany({where:{reference:{in:batchRefs}}});
 if(financialVersionId){
  await db.financialPlanState.update({where:{id:1},data:{currentVersionId:1,revision:1}});
  await db.financialPlanVersion.delete({where:{id:financialVersionId}});
 }
 await db.cmsAudit.deleteMany({where:{actorId:id}});
 await db.staffSession.deleteMany({where:{staffId:id}});
 await db.staffUser.deleteMany({where:{id}});
 await db.$disconnect();
}
