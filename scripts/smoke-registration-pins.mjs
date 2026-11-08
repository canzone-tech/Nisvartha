import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';

const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
const argon2=require('argon2');
if(!process.env.DATABASE_URL||new URL(process.env.DATABASE_URL).pathname!=='/nisvartha_ci')
 throw Error('Real no-fee registration PIN smoke must use isolated CI MySQL only');
const port=await new Promise((done,reject)=>{
 const s=createServer();s.once('error',reject);
 s.listen(0,'127.0.0.1',()=>{
  const a=s.address();if(!a||typeof a==='string')return reject(Error('Port unavailable'));
  s.close(()=>done(a.port));
 });
});
const api='http://127.0.0.1:'+port+'/api/v1';
const sid=randomUUID(),batchIds=[],memberIds=[];
const password='Test-Pin-Admin-Only-Secret-2026';
const memberPassword='NoFee-Registration-Applicant-2026';
const email=()=>('access-'+randomUUID().slice(0,8)+'@example.invalid');
const request=async(path,method='GET',body,token)=>{
 const r=await fetch(api+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),
  ...(token?{Authorization:'Bearer '+token}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}
 return {status:r.status,data};
};
const signup=registrationPin=>({
 email:email(),displayName:'Nonfinancial Test Applicant',password:memberPassword,
 registrationPin,termsVersion:'signed-terms-fixture',privacyVersion:'signed-privacy-fixture',
 consent:true,communicationOptIn:false
});
const assisted=registrationPin=>({...signup(registrationPin),applicantPresent:true});
let child;
try{
 const hash=await argon2.hash(password,{
  type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
 await db.staffUser.create({data:{id:sid,email:'access-admin-'+sid.slice(0,8)+'@example.invalid',
  displayName:'Registration Access Admin',passwordHash:hash,role:'ADMIN'}});
 child=spawn(process.execPath,['backend/dist/main.js'],{
  env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),
   REGISTRATION_ACCESS_PIN_ENABLED:'true',NISVARTHA_UAT_PIN_REGISTRATION:'false',
   MEMBER_PORTAL_ENABLED:'true',MEMBER_APPLICATIONS_ENABLED:'true',
   MEMBER_STAFF_REGISTRATION_ENABLED:'true',MATRIX_PLACEMENT_ENABLED:'true',
   MEMBER_TERMS_VERSION:'signed-terms-fixture',MEMBER_PRIVACY_VERSION:'signed-privacy-fixture'},
  stdio:'ignore',detached:true});
 let ready=false;
 for(let i=0;i<80;i++){
  try{if((await fetch(api+'/health/ready')).ok){ready=true;break}}catch{}
  await new Promise(done=>setTimeout(done,200));
 }
 assert.ok(ready,'Compiled API failed with production-like flags');
 const login=await request('/staff/login','POST',{
  email:'access-admin-'+sid.slice(0,8)+'@example.invalid',password});
 assert.equal(login.status,200,'Admin authentication failed');
 const token=login.data.accessToken,endpoint='/cms/membership/registration-pins';
 assert.equal((await request(endpoint)).status,401,'Anonymous PIN inventory exposed');
 assert.equal((await request(endpoint,'POST',{quantity:1})).status,401,'Anonymous PIN creation exposed');
 const batch={requestKey:randomUUID(),quantity:4,expiresAt:'2099-12-31T23:59:00+05:30'};
 const invalid=await request(endpoint,'POST',{...batch,quantity:0},token);
 assert.equal(invalid.status,400,'Invalid quantity accepted');
 const created=await request(endpoint,'POST',batch,token);
 assert.equal(created.status,201,'PIN issuance failed: '+JSON.stringify(created.data));
 assert.equal(created.data.classification,'NONFINANCIAL_REGISTRATION_ACCESS');
 assert.equal(created.data.codes.length,4);
 assert.equal(new Set(created.data.codes).size,4,'Duplicate code generated');
 assert.ok(created.data.codes.every(x=>/^[A-Za-z0-9_-]{43}$/.test(x)));
 batchIds.push(created.data.batchId);
 const list=await request(endpoint+'?status=AVAILABLE','GET',undefined,token);
 assert.equal(list.status,200,'Inventory unavailable');
 assert.equal(list.data.classification,'NONFINANCIAL_REGISTRATION_ACCESS');
 assert.equal(list.data.items.filter(x=>x.batchId===created.data.batchId).length,4);
 assert.deepEqual(new Set(list.data.items.filter(x=>x.batchId===created.data.batchId).map(x=>x.code)),
  new Set(created.data.codes),'Admin must recover issued full PINs after creation');
 assert.ok(list.data.items.every(x=>!('tokenHash' in x)&&!('codes' in x)),
  'Bearer leaked through inventory');
 assert.equal((await request(endpoint,'POST',batch,token)).status,409,
  'Idempotency retry must not reissue secrets');
 assert.equal((await db.registrationPinBatch.count({where:{requestKey:batch.requestKey}})),1);
 const stored=await db.registrationPin.findMany({where:{batchId:created.data.batchId}});
 assert.equal(stored.length,4);
 for(const pin of stored){
  assert.match(pin.tokenHash,/^[a-f0-9]{64}$/);
  assert.ok(!created.data.codes.includes(pin.tokenHash),'Plain bearer stored in MySQL');
  assert.ok(pin.sealedCode?.startsWith('v1.'),'Encrypted PIN is missing from MySQL');
  assert.ok(!created.data.codes.some(code=>pin.sealedCode.includes(code)),'Plaintext PIN leaked to sealed column');
 }
 const [c1,c2,c3,c4]=created.data.codes;
 // 0016 is append-only: existing digest-only rows remain usable but unrecoverable.
 const legacy=stored.find(x=>x.displaySuffix===c4.slice(-6));
 assert.ok(legacy?.sealedCode);
 await db.registrationPin.update({where:{id:legacy.id},data:{sealedCode:null}});
 const masked=await request(endpoint+'?status=AVAILABLE','GET',undefined,token);
 assert.equal(masked.status,200);
 assert.equal(masked.data.items.find(x=>x.id===legacy.id)?.code,null,'Legacy PIN must remain masked');
 await db.registrationPin.update({where:{id:legacy.id},data:{sealedCode:legacy.sealedCode}});
 const missing=await request('/cms/membership/applications/register','POST',
 {...assisted(c1),registrationPin:undefined},token);
 assert.equal(missing.status,400,'Real PIN mode accepted missing PIN');
 const sponsorInput=signup(c1);
 const first=await request('/members/register','POST',sponsorInput);
 assert.equal(first.status,201,'Real PIN signup failed '+JSON.stringify(first.data));
 memberIds.push(first.data.id);
 assert.equal(first.data.status,'SUBMITTED','No auto-approval from a PIN');
 assert.equal((await db.memberAccount.findUniqueOrThrow({where:{id:first.data.id}})).status,'PENDING');
 assert.equal((await db.registrationPin.count({where:{
  redeemedByMemberId:first.data.id,redeemedAt:{not:null}}})),1);
 assert.equal((await request('/members/register','POST',signup(c1))).status,400,
  'Consumed code replay accepted');
 const invalidInvite=await request('/cms/membership/applications/register','POST',
 {...assisted(c2),inviteCode:'AAAAAAAAAAAAAAAAAAAAAA'},token);
 assert.equal(invalidInvite.status,400,'Nonfinancial real PIN mode accepted inviter');
 assert.equal((await db.registrationPin.count({where:{batchId:created.data.batchId,redeemedAt:null}})),3);
 // A submitted or unapproved sponsor cannot recruit an applicant.
 const pendingSponsor=await db.memberAccount.findUniqueOrThrow({where:{id:first.data.id}});
 const pendingInvite=await request('/members/register','POST',{
  ...signup(c2),inviteCode:pendingSponsor.referralCode
 });
 assert.equal(pendingInvite.status,400,'Pending sponsor invitation accepted');
 assert.equal((await db.registrationPin.count({where:{batchId:created.data.batchId,redeemedAt:null}})),3,
  'Invalid inviter consumed a no-fee registration PIN');
 const reviewBase='/cms/membership/applications/'+first.data.applicationReference;
 assert.equal((await request(reviewBase+'/review','POST',{},token)).status,200,
  'Single ADMIN could not review sponsor');
 assert.equal((await request(reviewBase+'/decide','POST',{status:'APPROVED',
  reason:'Approved for nonfinancial invitation test'},token)).status,200,
  'Single ADMIN could not approve sponsor');
 const rootPosition=await db.matrixPosition.findFirstOrThrow({where:{memberId:first.data.id,kind:'ORIGINAL'}});
 assert.equal(rootPosition.sequence,1);
 assert.equal(rootPosition.parentId,null);
 assert.equal(rootPosition.slot,0);
 const approvedSponsor=await db.memberAccount.findUniqueOrThrow({where:{id:first.data.id}});
 assert.equal(approvedSponsor.status,'ACTIVE');
 const sponsorLogin=await request('/members/login','POST',{email:sponsorInput.email,password:memberPassword});
 assert.equal(sponsorLogin.status,200,'Approved sponsor cannot login');
 const sponsorToken=sponsorLogin.data.accessToken;
 const sponsorMe=await request('/members/me','GET',undefined,sponsorToken);
 assert.equal(sponsorMe.status,200);
 assert.equal(sponsorMe.data.referralCode,approvedSponsor.referralCode);
 const results=await Promise.all([signup(c2),signup(c2)].map(x=>
  request('/members/register','POST',{...x,inviteCode:approvedSponsor.referralCode})));
 assert.deepEqual(results.map(x=>x.status).sort((a,b)=>a-b),[201,400],
  'Concurrent registration PIN must be consumed only once');
 memberIds.push(results.find(x=>x.status===201).data.id);
 const third=await request('/cms/membership/applications/register','POST',{
  ...assisted(c3),inviteCode:approvedSponsor.referralCode
 },token);
 assert.equal(third.status,201,'Admin-assisted real PIN registration failed: '+JSON.stringify(third.data));
 memberIds.push(third.data.id);
 const publicWinner=results.find(x=>x.status===201).data;
 for(const createdMember of [publicWinner,third.data]){
  const base='/cms/membership/applications/'+createdMember.applicationReference;
  assert.equal((await request(base+'/review','POST',{},token)).status,200);
  assert.equal((await request(base+'/decide','POST',{
   status:'APPROVED',reason:'Approved for persistent 1:3 matrix test'
  },token)).status,200);
 }
 const positions=await db.matrixPosition.findMany({
  where:{memberId:{in:[first.data.id,publicWinner.id,third.data.id]}},orderBy:{sequence:'asc'}
 });
 assert.deepEqual(positions.map(x=>[x.sequence,x.slot]),[[1,0],[2,1],[3,2]],
  'Approved members were not placed breadth-first into 1:3 slots');
 assert.equal(positions[1].parentId,positions[0].id);
 assert.equal(positions[2].parentId,positions[0].id);
 const source=await db.membershipApplication.findUniqueOrThrow({where:{memberId:third.data.id}});
 assert.equal(source.registrationSource,'STAFF_ASSISTED');
 assert.equal(source.registeredByStaffId,sid);
 const direct=await db.memberInvitation.findMany({where:{inviterId:first.data.id}});
 assert.equal(direct.length,2,'Public and staff-assisted invitees were not attributed');
 assert.deepEqual(new Set(direct.map(x=>x.inviteeId)),
  new Set([results.find(x=>x.status===201).data.id,third.data.id]));
 const sponsorAfter=await request('/members/me','GET',undefined,sponsorToken);
 assert.equal(sponsorAfter.data.invitedCount,2,'Production-like member invitation count missing');
 const genealogy=await request('/members/genealogy','GET',undefined,sponsorToken);
 assert.equal(genealogy.status,200,'Production-like member invitation tree unavailable');
 assert.equal(genealogy.data.kind,'DIRECT_INVITATIONS');
 assert.equal(genealogy.data.root.id,first.data.id);
 assert.equal(genealogy.data.root.children.length,2);
 assert.ok(!JSON.stringify(genealogy.data).includes(sponsorInput.email),
  'Private member genealogy exposed email');
 const memberMatrix=await request('/members/matrix','GET',undefined,sponsorToken);
 assert.equal(memberMatrix.status,200,'Approved member matrix unavailable');
 assert.equal(memberMatrix.data.kind,'FORCED_1_TO_3');
 assert.equal(memberMatrix.data.root.memberId,first.data.id);
 assert.equal(memberMatrix.data.root.children.length,2);
 assert.deepEqual(memberMatrix.data.levels.map(x=>x.filled),[2,0,0,0,0]);
 assert.equal(memberMatrix.data.canCredit,false);
 assert.equal(memberMatrix.data.canPay,false);
 assert.deepEqual(memberMatrix.data.rebirthPositions,[]);
 const adminMatrix=await request('/cms/membership/matrix/'+first.data.id,'GET',undefined,token);
 assert.equal(adminMatrix.status,200,'ADMIN member matrix unavailable');
 assert.equal(adminMatrix.data.root.children.length,2);
 const adminTree=await request('/cms/membership/genealogy/'+first.data.id,'GET',undefined,token);
 assert.equal(adminTree.status,200,'Single ADMIN cannot inspect direct invitation tree');
 assert.equal(adminTree.data.root.children.length,2);
 const last=stored.find(x=>x.displaySuffix===c4.slice(-6));
 assert.ok(last);
 await db.registrationPin.update({where:{id:last.id},data:{expiresAt:new Date('2000-01-01T00:00:00Z')}});
 assert.equal((await request('/cms/membership/applications/register','POST',assisted(c4),token)).status,400,
  'Expired PIN accepted');
 const expired=await request(endpoint+'?status=EXPIRED','GET',undefined,token);
 assert.equal(expired.status,200);
 assert.ok(expired.data.items.some(x=>x.id===last.id),'Expired PIN missing');
 const used=await request(endpoint+'?status=USED','GET',undefined,token);
 assert.equal(used.status,200);
 assert.equal(used.data.items.filter(x=>x.batchId===created.data.batchId).length,3);
 assert.ok(used.data.items.filter(x=>x.batchId===created.data.batchId).every(x=>created.data.codes.includes(x.code)),
  'Used PINs must remain recoverable to authorized Admin');
 assert.ok((await db.cmsAudit.count({where:{actorId:sid,action:'REGISTRATION_PINS_VIEWED'}}))>=3,
  'Encrypted Admin PIN inventory reads must be audited');
 assert.equal((await request(endpoint+'?cursor=invalid','GET',undefined,token)).status,400);
 assert.equal((await db.cmsAudit.count({where:{actorId:sid,
  action:'REGISTRATION_ACCESS_PINS_CREATED'}})),1);
 assert.equal((await db.memberInvitation.count({where:{inviteeId:{in:memberIds}}})),2,
  'No-fee PIN must persist only approved direct invitation attribution');
 assert.equal(await db.uatScenarioEntry.count({where:{sourceMemberId:{in:memberIds}}}),0,
  'No-fee invitation signup must not create synthetic financial events');
 console.log('No-fee PIN, approved invitations, persistent 1:3 matrix, genealogy, replay and audit: PASS');
}finally{
 if(child?.pid){
  const done=new Promise(r=>child.once('exit',r));
  try{process.kill(-child.pid,'SIGTERM')}catch{}
  await Promise.race([done,new Promise(r=>setTimeout(r,2500))]);
 }
 const matrixRows=await db.matrixPosition.findMany({
  where:{memberId:{in:memberIds}},orderBy:{sequence:'desc'},select:{id:true}
 });
 for(const row of matrixRows)await db.matrixPosition.delete({where:{id:row.id}});
 if(matrixRows.length)await db.matrixState.update({where:{id:1},data:{nextSequence:1}});
 await db.memberInvitation.deleteMany({where:{OR:[
  {inviterId:{in:memberIds}},{inviteeId:{in:memberIds}}
 ]}});
 await db.registrationPin.deleteMany({where:{batchId:{in:batchIds}}});
 await db.registrationPinBatch.deleteMany({where:{id:{in:batchIds}}});
 await db.membershipApplication.deleteMany({where:{memberId:{in:memberIds}}});
 await db.memberSession.deleteMany({where:{memberId:{in:memberIds}}});
 await db.memberAudit.deleteMany({where:{memberId:{in:memberIds}}});
 await db.memberAccount.deleteMany({where:{id:{in:memberIds}}});
 await db.cmsAudit.deleteMany({where:{actorId:sid}});
 await db.staffSession.deleteMany({where:{staffId:sid}});
 await db.staffUser.deleteMany({where:{id:sid}});
 await db.$disconnect();
}
