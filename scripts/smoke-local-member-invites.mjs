import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');

// Runs against the SAME compiled Next/Nest servers as local UAT. No new
// listeners, hardcoded credentials, production writes or migration changes.
const local=(value)=>{
 const u=new URL(value||'');
 if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||u.username||
    u.password||u.pathname!=='/'||u.search||u.hash)
  throw Error('Integrated synthetic member smoke requires loopback HTTP');
 return u.origin;
};
const web=local(process.env.NISVARTHA_UAT_WEB_ORIGIN);
const dbUrl=new URL(process.env.DATABASE_URL||'');
if(dbUrl.protocol!=='mysql:'||!['127.0.0.1','localhost'].includes(dbUrl.hostname)||
   dbUrl.pathname!=='/nisvartha_ci'||process.env.NODE_ENV==='production'||
   process.env.NISVARTHA_UAT_PIN_REGISTRATION!=='synthetic'||
   process.env.MEMBER_APPLICATIONS_ENABLED!=='true')
 throw Error('Integrated synthetic member smoke refuses production or non-CI DB');
const config={
 adminEmail:process.env.NISVARTHA_UAT_STAFF_EMAIL,
 adminPassword:process.env.NISVARTHA_UAT_STAFF_PASSWORD,
 reviewerEmail:process.env.NISVARTHA_UAT_APPROVER_EMAIL,
 reviewerPassword:process.env.NISVARTHA_UAT_APPROVER_PASSWORD
};
for(const email of [config.adminEmail,config.reviewerEmail])
 assert.ok(typeof email==='string'&&email.endsWith('@example.invalid'));
for(const password of [config.adminPassword,config.reviewerPassword])
 assert.ok(typeof password==='string'&&password.length>=14);
assert.notEqual(config.adminEmail,config.reviewerEmail);

const db=new PrismaClient();
const memberIds=[],applicationIds=[],batchIds=[];
const pass='Synthetic-Integrated-Uat-Member-2026';
const post=async(path,body,cookie)=>{
 const response=await fetch(web+path,{
  method:'POST',cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(10000),
  headers:{Origin:web,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},
  body:JSON.stringify(body)
 });
 const result=await response.json().catch(()=>null);
 return {status:response.status,result,response};
};
const staffLogin=async(email,password)=>{
 const login=await post('/api/admin/session/login',{email,password});
 assert.equal(login.status,200,'Synthetic staff browser login failed');
 const cookie=login.response.headers.get('set-cookie')?.split(';')[0]||'';
 assert.match(cookie,/nisvartha_staff_access=/,'Staff cookie missing');
 return cookie;
};
try{
 const adminCookie=await staffLogin(config.adminEmail,config.adminPassword);
 const approverCookie=await staffLogin(config.reviewerEmail,config.reviewerPassword);
 const pins=await post('/api/admin/backend/cms/membership/uat-pins',{
  quantity:3,expiresAt:'2099-01-31T23:59:00+05:30',requestKey:randomUUID()
 },adminCookie);
 assert.equal(pins.status,201,'Integrated synthetic one-time PIN creation failed');
 assert.equal(pins.result?.classification,'SYNTHETIC_NONFINANCIAL_UAT_ONLY');
 assert.equal(pins.result?.codes?.length,3);
 batchIds.push(pins.result.batchId);
 const [first,second,third]=pins.result.codes;
 const apply=(pin,email,inviteCode)=>({
  email,displayName:'Fake Integrated Applicant',password:pass,
  termsVersion:process.env.MEMBER_TERMS_VERSION,
  privacyVersion:process.env.MEMBER_PRIVACY_VERSION,
  consent:true,communicationOptIn:false,registrationPin:pin,
  ...(inviteCode?{inviteCode}:{})
 });
 const sponsorEmail='local-sponsor-'+randomUUID().slice(0,8)+'@example.invalid';
 const sponsor=await post('/api/member/session/register',apply(first,sponsorEmail));
 assert.equal(sponsor.status,201,'Sponsor public signup with E-PIN failed');
 assert.equal(sponsor.result?.status,'SUBMITTED');
 memberIds.push(sponsor.result.id);applicationIds.push(sponsor.result.applicationReference);
 const prefix='/api/admin/backend/cms/membership/applications/'+sponsor.result.applicationReference;
 const review=await post(prefix+'/review',{},approverCookie);
 assert.equal(review.status,200,'Independent approver cannot review sponsor');
 const approved=await post(prefix+'/decide',{
  status:'APPROVED',reason:'Synthetic integrated acceptance evidence only'
 },approverCookie);
 assert.equal(approved.status,200,'Independent approver cannot approve sponsor');
 const logged=await post('/api/member/session/login',{email:sponsorEmail,password:pass});
 assert.equal(logged.status,200,'Approved sponsor cannot log in through browser BFF');
 const memberCookie=logged.response.headers.get('set-cookie')?.split(';')[0]||'';
 assert.match(memberCookie,/nisvartha_member_access=/);
 const memberPage=await fetch(web+'/member',{
  headers:{Cookie:memberCookie},cache:'no-store',signal:AbortSignal.timeout(10000)
 });
 assert.equal(memberPage.status,200,'Authenticated member dashboard missing');
 const html=await memberPage.text();
 assert.match(html,/Your nonfinancial invitation code/,'Approved member invite UI missing');
 const actual=await db.memberAccount.findUniqueOrThrow({where:{id:sponsor.result.id}});
 assert.match(actual.referralCode,/^[A-Za-z0-9_-]{22}$/);
 const referred=await post('/api/member/session/register',apply(
  second,'local-invitee-'+randomUUID().slice(0,8)+'@example.invalid',actual.referralCode
 ));
 assert.equal(referred.status,201,'Public invitee PIN and inviter signup failed');
 memberIds.push(referred.result.id);applicationIds.push(referred.result.applicationReference);
 const edge=await db.memberInvitation.findUniqueOrThrow({where:{inviteeId:referred.result.id}});
 assert.equal(edge.inviterId,sponsor.result.id,'Direct inviter not attributed to sponsor');
 const assisted=await post('/api/admin/backend/cms/membership/applications/register',{
  ...apply(third,'local-assisted-'+randomUUID().slice(0,8)+'@example.invalid',actual.referralCode),
  applicantPresent:true,consentEvidenceRef:'CONSENT-LOCAL-SYNTHETIC-2026'
 },adminCookie);
 assert.equal(assisted.status,201,'Staff-assisted PIN plus inviter signup failed');
 memberIds.push(assisted.result.id);applicationIds.push(assisted.result.applicationReference);
 const staffApp=await db.membershipApplication.findUniqueOrThrow({
  where:{id:assisted.result.applicationReference}
 });
 assert.equal(staffApp.registrationSource,'STAFF_ASSISTED');
 const secondEdge=await db.memberInvitation.findUniqueOrThrow({
  where:{inviteeId:assisted.result.id}
 });
 assert.equal(secondEdge.inviterId,sponsor.result.id);
 const count=await db.memberInvitation.count({where:{inviterId:sponsor.result.id}});
 assert.equal(count,2,'Both public and staff invitees must be attributed');
 const used=await db.uatSignupPin.count({where:{
  batchId:pins.result.batchId,redeemedAt:{not:null}
 }});
 assert.equal(used,3,'All synthetic codes must be consumed exactly once');
 const replay=await post('/api/member/session/register',apply(
  second,'local-replay-'+randomUUID().slice(0,8)+'@example.invalid'
 ));
 assert.equal(replay.status,400,'Consumed PIN was reused');
 const dashboardAgain=await fetch(web+'/member',{
  headers:{Cookie:memberCookie},cache:'no-store',signal:AbortSignal.timeout(10000)
 });
 assert.match(await dashboardAgain.text(),/Applications attributed: 2/,
  'Live member dashboard referral count did not update');
 console.log('Single-runtime synthetic E-PIN → public signup → independent review → active invite code → public/staff attribution + single-use replay: PASS');
}finally{
 // Only delete the unique synthetic fixture we created; the parent launcher
 // owns and disposes the entire database on exit.
 await db.memberInvitation.deleteMany({where:{OR:[
  {inviterId:{in:memberIds}},{inviteeId:{in:memberIds}}
 ]}});
 await db.uatSignupPin.deleteMany({where:{batchId:{in:batchIds}}});
 await db.uatSignupPinBatch.deleteMany({where:{id:{in:batchIds}}});
 await db.memberSession.deleteMany({where:{memberId:{in:memberIds}}});
 await db.membershipApplication.deleteMany({where:{memberId:{in:memberIds}}});
 await db.memberAudit.deleteMany({where:{memberId:{in:memberIds}}});
 await db.memberAccount.deleteMany({where:{id:{in:memberIds}}});
 await db.cmsAudit.deleteMany({where:{
  OR:[
   {objectType:'MEMBER_APPLICATION',objectId:{in:applicationIds}},
   {action:'UAT_SIGNUP_PINS_CREATED',objectId:{in:batchIds}}
  ]
 }});
 await db.$disconnect();
}
