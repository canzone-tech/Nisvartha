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
 adminPassword:process.env.NISVARTHA_UAT_STAFF_PASSWORD
};
for(const email of [config.adminEmail])
 assert.ok(typeof email==='string'&&email.endsWith('@example.invalid'));
for(const password of [config.adminPassword])
 assert.ok(typeof password==='string'&&password.length>=14);

const db=new PrismaClient();
const memberIds=[],applicationIds=[],batchIds=[],scenarioIds=[];
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
 const approverCookie=adminCookie; // One Admin performs every workflow.
 // Same-session, authorized policy modelling. The only persistent side effect
 // is the logged staff preview, never placement/commission/rebirth issuance.
 if(process.env.NISVARTHA_UAT_PLAN==='synthetic'){
  const route='/api/admin/backend/staff/matrix-preview';
  assert.equal((await fetch(web+route+'/defaults')).status,401,
   'Anonymous matrix policy defaults exposed');

  const defaults=await fetch(web+route+'/defaults',{
   headers:{Cookie:adminCookie},signal:AbortSignal.timeout(10000)
  });
  assert.equal(defaults.status,200,'ADMIN matrix configuration unavailable');
  const policy=await defaults.json();
  assert.equal(policy.persisted,false);
  assert.equal(policy.reference.width,3);
  const beforeMembers=await db.memberAccount.count();
  const preview=await post(route+'/simulate',{
   ...policy.config,entrants:363
  },adminCookie);
  assert.equal(preview.status,200,'Full five-level simulation failed');
  assert.equal(preview.result.status,'SIMULATION_ONLY');
  assert.equal(preview.result.canCredit,false);
  assert.equal(preview.result.canIssueRebirth,false);
  assert.deepEqual(preview.result.levels.map(x=>x.filled),[3,9,27,81,243]);
  assert.deepEqual(preview.result.rebirthCandidates.map(x=>x.count),[1,3]);
  assert.equal(await db.memberAccount.count(),beforeMembers,
   'Matrix simulation accidentally wrote member accounts');
  const bad=await post(route+'/simulate',{
   ...policy.config,entrants:364
  },adminCookie);
  assert.equal(bad.status,400,'Over-capacity simulation was accepted');

  const audits=await db.cmsAudit.count({
   where:{action:'MATRIX_REBIRTH_POLICY_SIMULATED',actorId:
    (await db.staffUser.findUniqueOrThrow({where:{email:config.adminEmail}})).id}
  });
  assert.ok(audits>=1,'Successful policy preview must be audited');
  // Exact compiled route + cookies + isolated MySQL, including separate
  // reviewer authority and immutable versioning.
  assert.equal((await fetch(web+route+'/policies')).status,401,
   'Anonymous caller accessed scenario drafts');
  const key=randomUUID();
  const savedScenario=await post(route+'/policies',{
   ...policy.config,entrants:120,requestKey:key
  },adminCookie);
  assert.equal(savedScenario.status,201,'Admin failed to save version');
  assert.equal(savedScenario.result?.status,'DRAFT');
  const scenarioId=savedScenario.result.id;
  scenarioIds.push(scenarioId);
  const duplicate=await post(route+'/policies',{
   ...policy.config,entrants:120,requestKey:key
  },adminCookie);
  assert.equal(duplicate.result?.id,scenarioId,'Retry duplicated policy');
  assert.equal((await post(route+'/policies/'+scenarioId+'/review',{
   decision:'REVIEWED',reason:'Draft cannot be reviewed before submission'
  },adminCookie)).status,409,'Unsubmitted scenario was reviewed');
  assert.equal((await post(route+'/policies/'+scenarioId+'/submit',{},
   adminCookie)).status,201,'Author could not submit the scenario');
  const independent=await post(route+'/policies/'+scenarioId+'/review',{
   decision:'REVIEWED',reason:'Simulated policy reviewed for design only'
  },approverCookie);
  assert.equal(independent.status,201,'Admin could not review');
  assert.equal(independent.result.active,false);
  assert.equal(independent.result.canCredit,false);
  assert.equal((await post(route+'/policies/'+scenarioId+'/review',{
   decision:'REJECTED',reason:'Cannot review twice'
  },approverCookie)).status,409,'Double review accepted');
  const listed=await fetch(web+route+'/policies',{
   headers:{Cookie:approverCookie},signal:AbortSignal.timeout(10000)
  });
  assert.equal(listed.status,200,'Admin cannot read policy history');
  const versions=await listed.json();
  assert.equal(versions.find(v=>v.id===scenarioId)?.status,'REVIEWED');
  assert.equal((await db.sandboxPolicyRevision.count({where:{requestKey:key}})),1);
  assert.equal(await db.memberAccount.count(),beforeMembers,
   'Scenario review unexpectedly added real members');
 }

 const pins=await post('/api/admin/backend/cms/membership/uat-pins',{
  quantity:4,expiresAt:'2099-01-31T23:59:00+05:30',requestKey:randomUUID()
 },adminCookie);
 assert.equal(pins.status,201,'Integrated synthetic one-time PIN creation failed');
 assert.equal(pins.result?.classification,'SYNTHETIC_NONFINANCIAL_UAT_ONLY');
 assert.equal(pins.result?.codes?.length,4);
 batchIds.push(pins.result.batchId);
 const inventory=await fetch(web+'/api/admin/backend/cms/membership/uat-pins?status=AVAILABLE',{headers:{Cookie:adminCookie},cache:'no-store'});
 assert.equal(inventory.status,200,'Admin inventory unavailable');
 const stock=await inventory.json();
 assert.equal(stock.items.filter(pin=>pin.batchId===pins.result.batchId).length,4);
 assert.ok(stock.items.every(pin=>!('tokenHash' in pin)&&!('codes' in pin)),'E-PIN secret leaked via list');
 const [first,second,third,fourth]=pins.result.codes;
 const apply=(pin,email,inviteCode)=>({
  email,displayName:'Fake Integrated Applicant',password:pass,
  termsVersion:process.env.MEMBER_TERMS_VERSION,
  privacyVersion:process.env.MEMBER_PRIVACY_VERSION,
  consent:true,communicationOptIn:false,registrationPin:pin,
  ...(inviteCode?{inviteCode}:{})
 });
 const attemptedReal=await post('/api/member/session/register',
  apply(first,'not-a-test-member@gmail.com'));
 assert.equal(attemptedReal.status,400,'Synthetic PIN accepted a real email address');
 const sponsorEmail='local-sponsor-'+randomUUID().slice(0,8)+'@example.invalid';
 const sponsor=await post('/api/member/session/register',apply(first,sponsorEmail));
 assert.equal(sponsor.status,201,'Sponsor public signup with E-PIN failed');
 assert.equal(sponsor.result?.status,'SUBMITTED');
 memberIds.push(sponsor.result.id);applicationIds.push(sponsor.result.applicationReference);
 const prefix='/api/admin/backend/cms/membership/applications/'+sponsor.result.applicationReference;
 const review=await post(prefix+'/review',{},approverCookie);
 assert.equal(review.status,200,'Admin cannot review sponsor');
 const approved=await post(prefix+'/decide',{
  status:'APPROVED',reason:'Synthetic integrated acceptance evidence only'
 },approverCookie);
 assert.equal(approved.status,200,'Admin cannot approve sponsor');
 const logged=await post('/api/member/session/login',{email:sponsorEmail,password:pass});
 assert.equal(logged.status,200,'Approved sponsor cannot log in through browser BFF');
 const memberCookie=logged.response.headers.get('set-cookie')?.split(';')[0]||'';
 assert.match(memberCookie,/nisvartha_member_access=/);
 const memberPage=await fetch(web+'/member',{
  headers:{Cookie:memberCookie},cache:'no-store',signal:AbortSignal.timeout(10000)
 });
 assert.equal(memberPage.status,200,'Authenticated member dashboard missing');
 const html=await memberPage.text();
 assert.match(html,/Member workspace navigation/,'Approved member sidebar missing');
 assert.match(html,/data-member-view="overview"/,'Member workspace initial tab not rendered');
 assert.match(html,/>Invitations</,'Approved sponsor has no invitation navigation');
 assert.match(html,/Your membership at a glance/,'Member overview unavailable');
 // Invitation code now lives behind the Invitations tab; its authoritative
 // issuance and subsequent use are verified below against MySQL.

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
 // The inviter of a second generation must first pass admin approval.
 const childPrefix='/api/admin/backend/cms/membership/applications/'+referred.result.applicationReference;
 assert.equal((await post(childPrefix+'/review',{},approverCookie)).status,200);
 assert.equal((await post(childPrefix+'/decide',{
  status:'APPROVED',reason:'Synthetic level-two genealogy approval only'
 },approverCookie)).status,200);
 const childAccount=await db.memberAccount.findUniqueOrThrow({where:{id:referred.result.id}});
 const grandchild=await post('/api/member/session/register',apply(
  fourth,'local-grandchild-'+randomUUID().slice(0,8)+'@example.invalid',
  childAccount.referralCode
 ));
 assert.equal(grandchild.status,201,'Second-level referral PIN signup failed');
 memberIds.push(grandchild.result.id);applicationIds.push(grandchild.result.applicationReference);
 const grandchildEdge=await db.memberInvitation.findUniqueOrThrow({
  where:{inviteeId:grandchild.result.id}
 });
 assert.equal(grandchildEdge.inviterId,referred.result.id);
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
 assert.equal(used,4,'All synthetic codes must be consumed exactly once');
 const replay=await post('/api/member/session/register',apply(
  second,'local-replay-'+randomUUID().slice(0,8)+'@example.invalid'
 ));
 assert.equal(replay.status,400,'Consumed PIN was reused');

 // The member API always uses the authenticated actor as its tree root.
 const api=local(process.env.NISVARTHA_UAT_API_ORIGIN);
 const token=memberCookie.split('=')[1];
 const memberTreeResponse=await fetch(api+'/api/v1/members/genealogy',{
  headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)
 });
 assert.equal(memberTreeResponse.status,200,'Protected member genealogy unavailable');
 const own=await memberTreeResponse.json();
 assert.equal(own.kind,'DIRECT_INVITATIONS');
 assert.equal(own.root.id,sponsor.result.id);
 assert.equal(own.root.children.length,2);
 const child=own.root.children.find(node=>node.id===referred.result.id);
 assert.ok(child,'Direct member edge missing from genealogy');
 assert.equal(child.children.length,1,'Second-level genealogy child missing');
 assert.equal(child.children[0].id,grandchild.result.id);
 assert.equal(own.shown,4);
 assert.equal(own.truncated,false);
 assert.equal(own.maximumLevel,5);
 assert.ok(!JSON.stringify(own).includes(sponsorEmail),'Member genealogy leaked email');
 assert.ok(!JSON.stringify(own).includes('Fake Integrated Applicant'),
  'Member genealogy leaked invitee display names');

 const adminTreeUrl='/api/admin/backend/cms/membership/genealogy/'+sponsor.result.id;
 assert.equal((await fetch(web+adminTreeUrl)).status,401,'Anonymous staff BFF accessed genealogy');
 const staffGenealogy=await fetch(web+adminTreeUrl,{
  headers:{Cookie:adminCookie},signal:AbortSignal.timeout(10000)
 });
 assert.equal(staffGenealogy.status,200,'ADMIN cannot view genealogy');
 const privileged=await staffGenealogy.json();
 assert.equal(privileged.root.id,sponsor.result.id);
 assert.equal(privileged.root.children.length,2);
 assert.ok(privileged.root.children.every(node=>node.label==='Fake Integrated Applicant'));
 assert.equal(privileged.shown,4);
 const adminPage=await fetch(web+'/admin/members',{
  headers:{Cookie:adminCookie}
 });
 assert.match(await adminPage.text(),/Membership applications/,
  'Admin membership workspace unavailable');

 const dashboardAgain=await fetch(web+'/member',{
  headers:{Cookie:memberCookie},cache:'no-store',signal:AbortSignal.timeout(10000)
 });
 const memberHtml=await dashboardAgain.text();
 assert.match(memberHtml,/Referral genealogy tree/,
  'Member dashboard did not render client-styled genealogy');
 assert.match(memberHtml,/Applications attributed:/,
  'Live member dashboard attribution section did not render');
 assert.doesNotMatch(memberHtml,/local-grandchild-.*@example.invalid/,
  'Member genealogy accidentally exposed descendant email');
 assert.equal(await db.memberInvitation.count({where:{inviterId:sponsor.result.id}}),2);
 console.log('Single-runtime synthetic PIN → approved sponsor → two direct invites → approved child → level-two grandchild, member privacy and staff RBAC: PASS');
}finally{
 // Only delete the unique synthetic fixture we created; the parent launcher
 // owns and disposes the entire database on exit.
 if(scenarioIds.length){
  await db.cmsAudit.deleteMany({where:{
   objectType:'SANDBOX_POLICY',objectId:{in:scenarioIds.map(String)}
  }});
  await db.sandboxPolicyRevision.deleteMany({where:{id:{in:scenarioIds}}});
 }
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
