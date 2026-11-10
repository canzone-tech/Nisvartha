import assert from 'node:assert/strict';
import {validateClientReviewArtifact,BUILD_KEYS} from './release-profile.mjs';
import {assertAutoPoolInformationalRoute} from './auto-pool-contract.mjs';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {randomUUID,randomInt} from 'node:crypto';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
const root=resolve(process.argv[2]||'dist/fullstack');
const api=join(root,'api'),web=join(root,'web');
const release=JSON.parse(readFileSync(join(root,'RELEASE_INFO.json'),'utf8'));
const expectedMigration=readdirSync(resolve('backend/prisma/migrations'),{withFileTypes:true})
 .filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort().at(-1);
assert.equal(release.migration_head,expectedMigration,
 'Compiled release metadata does not match the repository migration head');
const expectedBuildEnvKeys=BUILD_KEYS;
assert.deepEqual(Object.keys(release.build_env||{}),expectedBuildEnvKeys,
 'Compiled profile metadata absent from production release');
for(const key of expectedBuildEnvKeys)
 assert.equal(release.build_env[key],process.env[key]??'',
  'Compiled release profile disagrees with CI build: '+key);

assert.equal(readFileSync(join(root,'ops','prisma','schema.prisma'),'utf8'),
 readFileSync(resolve('backend/prisma/schema.prisma'),'utf8'),
 'Packaged production migrations have the wrong schema');
const packagedMigrations=readdirSync(join(root,'ops','prisma','migrations'),{withFileTypes:true})
 .filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort();
const originalMigrations=readdirSync(resolve('backend/prisma/migrations'),{withFileTypes:true})
 .filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort();
assert.deepEqual(packagedMigrations,originalMigrations,'Production migration chain incomplete');
for(const name of packagedMigrations)
 assert.equal(readFileSync(join(root,'ops','prisma','migrations',name,'migration.sql'),'utf8'),
  readFileSync(resolve('backend/prisma/migrations',name,'migration.sql'),'utf8'),
  'Published migration content drift: '+name);


for(const item of [join(api,'dist','main.js'),join(api,'node_modules','@prisma','client'),
 join(api,'scripts','bootstrap-admin.mjs'),join(api,'package.json'),
 join(root,'ops','deploy-migrations.mjs'),join(root,'ops','release-profile.mjs'),
 join(root,'ops','release-preflight.mjs'),join(root,'ops','prepare-release-env.mjs'),
 join(root,'ops','smoke-staged-artifact.mjs'),
 join(root,'ops','systemd','nisvartha-api.service'),
 join(root,'ops','systemd','nisvartha-web.service'),
 join(root,'ops','prisma','schema.prisma'),
 join(root,'ops','prisma','migrations',release.migration_head,'migration.sql'),
 join(root,'ops','package-lock.json'),join(web,'server.js'),join(web,'.next','static')])
 assert.ok(existsSync(item),'Compiled file missing '+item);
for(const item of [join(root,'.git'),join(api,'src'),join(web,'app'),
 join(web,'components'),join(web,'lib'),join(web,'public','client-template')])
 assert.ok(!existsSync(item),'Source/local-only path leaked into package '+item);
const freePort=()=>new Promise((done,reject)=>{
 const s=createServer();s.once('error',reject);
 s.listen(0,'127.0.0.1',()=>{
  const a=s.address();if(!a||typeof a==='string')return reject(Error('Port unavailable'));
  s.close(()=>done(a.port));
 });
});
const apiPort=await freePort(),webPort=await freePort();
const origin='http://127.0.0.1:'+webPort;
const clientReview=release.build_env.MEMBER_PORTAL_ENABLED==='true';
assert.equal(release.release_channel,process.env.NISVARTHA_RELEASE_CHANNEL,
 'Artifact channel mismatch with exact CI build');
if(release.release_channel==='client-review')
 assert.deepEqual(validateClientReviewArtifact(release),[],
  'CI tried to publish an unsafe client-review artifact');
const env={...process.env,NODE_ENV:'production',HOST:'127.0.0.1',HOSTNAME:'127.0.0.1',
 MEMBER_COMPENSATION_ENABLED:'false',MEMBER_COMPENSATION_APPROVED:'false',
 NISVARTHA_UAT_PIN_REGISTRATION:'false',NISVARTHA_UAT_PLAN:'off'};
assert.equal(release.build_env.MEMBER_COMPENSATION_ENABLED,'false',
 'No payment-enabled artifact may be published under the read-only client-review contract');
assert.equal(release.build_env.MEMBER_COMPENSATION_APPROVED,'false',
 'An unapproved financial entitlement may not be embedded into the client-review artifact');
if(clientReview){
 for(const field of [
  'MEMBER_PORTAL_ENABLED','MEMBER_APPLICATIONS_ENABLED',
  'MEMBER_STAFF_REGISTRATION_ENABLED','REGISTRATION_ACCESS_PIN_ENABLED',
  'MEMBER_PIN_AUTO_ACTIVATE_ENABLED','MATRIX_PLACEMENT_ENABLED','MEMBER_WALLET_ENABLED',
  'DONATION_ACCOUNTING_ENABLED'
 ])assert.equal(release.build_env[field],'true','Client review missing '+field);
 assert.ok(release.build_env.MEMBER_TERMS_VERSION&&release.build_env.MEMBER_PRIVACY_VERSION,
  'Review artifact missing the explicit terms/privacy identifiers');
}
const processes=[];
function start(file,cwd,port,extra={}){
 const child=spawn(process.execPath,[file],{cwd,detached:true,
  stdio:['ignore','ignore','pipe'],env:{...env,...extra,PORT:String(port)}});
 processes.push(child);
 return child;
}
async function ready(url,child){
 for(let i=0;i<100;i++){
  if(child.exitCode!==null)throw Error('Compiled runtime exited: '+url);
  try{if((await fetch(url,{signal:AbortSignal.timeout(1000)})).ok)return}catch{}
  await new Promise(done=>setTimeout(done,150));
 }
 throw Error('Compiled runtime did not become ready: '+url);
}
try{
 const back=start(join(api,'dist','main.js'),api,apiPort);
 await ready('http://127.0.0.1:'+apiPort+'/api/v1/health/live',back);
 await ready('http://127.0.0.1:'+apiPort+'/api/v1/health/ready',back);
 const front=start(join(web,'server.js'),web,webPort,
  {API_INTERNAL_URL:'http://127.0.0.1:'+apiPort});
 await ready(origin+'/',front);
 for(const path of ['/','/about','/projects','/contact','/robots.txt'])
  assert.equal((await fetch(origin+path)).status,200,'Public route '+path);
 if(clientReview){
  const registration=await fetch(origin+'/member/register');
  assert.equal(registration.status,200,'Client-review PIN registration route missing');
  const html=await registration.text();
  for(const field of ['registrationPin','inviteCode','displayName','email','password']){
   assert.match(html,new RegExp('name=["\x27]'+field+'["\x27]'),
    'Client-review registration missing '+field);
  }
  assert.match(html,/Register with your E-PIN and referral code/i,
   'Client-review screen still describes the deprecated approval journey');
  assert.match(html,/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i,
   'Member registration must never be indexed');
  const signIn=await fetch(origin+'/member/login');
  assert.equal(signIn.status,200,'Member login unavailable in review build');
  assert.match(await signIn.text(),/name=["']identifier["']/,
   'Member login missing email/referral identifier');
  const dashboard=await fetch(origin+'/member',{redirect:'manual'});
  assert.ok([307,308].includes(dashboard.status),
   'Anonymous member dashboard must redirect, not disclose user data');
  assert.equal(dashboard.headers.get('location'),'/member/login');
  assert.equal((await fetch('http://127.0.0.1:'+apiPort+'/api/v1/members/me')).status,401,
   'Anonymous member profile API was not protected');
 }else{
  assert.equal((await fetch(origin+'/member/register')).status,404,
   'Held release accidentally published member signup');
 }
 const autoPool=await fetch(origin+'/auto-pool-plan');
 const autoPoolHtml=await autoPool.text();
 assertAutoPoolInformationalRoute(autoPool.status,autoPoolHtml,'Full-stack compiled Auto Pool');
 assert.doesNotMatch(autoPoolHtml,/(prototype|demonstration|Review Pending|UAT)/i,
  'Compiled Auto Pool route leaked test-era copy');
 const admin=await fetch(origin+'/admin',{redirect:'manual'});
 assert.equal(admin.status,307,'Anonymous admin did not redirect');
 const anonymous=await fetch(origin+'/api/admin/backend/staff/me',{redirect:'manual'});
 assert.equal(anonymous.status,401,'Anonymous staff BFF was exposed');
 if(clientReview){
  // CI-only compiled Admin UAT: the live placement page must not be hidden
  // behind the synthetic matrix simulator flag. Never seed a live database.
  const dbName=new URL(process.env.DATABASE_URL||'').pathname;
  assert.equal(dbName,'/nisvartha_ci','Real Admin matrix smoke refuses non-CI MySQL');
  const require=createRequire(join(api,'package.json'));
  const {PrismaClient}=require('@prisma/client');
  const argon2=require('argon2');
  const db=new PrismaClient();
  const id=randomUUID();
  const email='release-matrix-'+id.slice(0,8)+'@example.invalid';
  const password='Release-Admin-Matrix-2026-Strong';
  try{
   const hash=await argon2.hash(password,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
   await db.staffUser.create({data:{id,email,displayName:'Release matrix reviewer',
    role:'ADMIN',passwordHash:hash,mustChangePassword:true}});
   const login=await fetch(origin+'/api/admin/session/login',{method:'POST',
    headers:{Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify({email,password})});
   assert.equal(login.status,200,'Compiled Admin sign-in unavailable');
   assert.equal((await login.json()).passwordChangeRequired,true,
    'Temporary Admin BFF must require first-login rotation');
   const restrictedCookie=(login.headers.get('set-cookie')||'').split(';')[0];
   assert.match(restrictedCookie,/^nisvartha_staff_access=/,'Restricted staff cookie missing');
   assert.equal((await fetch(origin+'/api/admin/backend/staff/me',
    {headers:{Cookie:restrictedCookie}})).status,403,
    'Temporary Admin could access full staff identity');
   const earlyAdmin=await fetch(origin+'/admin/matrix',
    {headers:{Cookie:restrictedCookie},redirect:'manual'});
   assert.ok([307,308].includes(earlyAdmin.status),
    'Temporary Admin rendered protected matrix dashboard');
   const passwordPage=await fetch(origin+'/admin/password',
    {headers:{Cookie:restrictedCookie}});
   assert.equal(passwordPage.status,200,'Compiled password-rotation page unavailable');
   assert.match(await passwordPage.text(),/Set a private administrator password/i);
   const wrongOrigin=await fetch(origin+'/api/admin/session/password',{
    method:'POST',headers:{Origin:'https://invalid.example','Content-Type':'application/json',
     Cookie:restrictedCookie},
    body:JSON.stringify({currentPassword:password,newPassword:'New-Admin-Secret-2026'})
   });
   assert.equal(wrongOrigin.status,403,'Cross-origin password change was allowed');
   const rotatedPassword='Release-Admin-Rotated-Strong-2026';
   const changed=await fetch(origin+'/api/admin/session/password',{
    method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:restrictedCookie},
    body:JSON.stringify({currentPassword:password,newPassword:rotatedPassword})
   });
   assert.equal(changed.status,200,'Compiled first-login password rotation failed');
   assert.match(changed.headers.get('set-cookie')||'',/max-age=0/i,
    'Password rotation must expire old staff cookie');
   assert.equal((await fetch(origin+'/api/admin/backend/staff/me',
    {headers:{Cookie:restrictedCookie}})).status,401,
    'Old restricted session remained valid');
   const oldSecret=await fetch(origin+'/api/admin/session/login',{method:'POST',
    headers:{Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify({email,password})});
   assert.equal(oldSecret.status,401,'Temporary Admin password still authenticates');
   const newLogin=await fetch(origin+'/api/admin/session/login',{method:'POST',
    headers:{Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify({email,password:rotatedPassword})});
   assert.equal(newLogin.status,200,'Rotated Admin could not sign in again');
   assert.equal((await newLogin.json()).passwordChangeRequired,false,
    'Admin was not released after password rotation');
   const cookie=(newLogin.headers.get('set-cookie')||'').split(';')[0];
   assert.match(cookie,/^nisvartha_staff_access=/,'Rotated staff session missing');
   const matrixPage=await fetch(origin+'/admin/matrix',{headers:{Cookie:cookie}});
   assert.equal(matrixPage.status,200,'Production Admin matrix page was gated off');
   const markup=await matrixPage.text();
   assert.match(markup,/1:3 member matrix/i,'Authoritative matrix explorer missing');
   const list=await fetch(origin+'/api/admin/backend/cms/membership/applications/page?status=APPROVED&limit=25',
    {headers:{Cookie:cookie}});
   assert.equal(list.status,200,'Protected matrix member list unavailable');
   assert.ok(Array.isArray((await list.json()).items));
   const donationPage=await fetch(origin+'/admin/donations',{headers:{Cookie:cookie}});
   assert.equal(donationPage.status,200,'Compiled NGO donation register route unavailable');
   assert.match(await donationPage.text(),/Offline donation register/i,
    'Compiled Admin is missing the donation register');
   const donationList=await fetch(origin+'/api/admin/backend/staff/donations',
    {headers:{Cookie:cookie}});
   assert.equal(donationList.status,200,'Authenticated offline donation register API unavailable');
   assert.ok(Array.isArray((await donationList.json()).items));
   assert.equal((await fetch(origin+'/api/admin/backend/staff/donations')).status,401,
    'Anonymous access to donation register was allowed');
   // End-to-end compiled delivery contract: Admin -> root -> issued PIN ->
   // ACTIVE member -> real login/session -> member matrix/wallet. Disposable DB only.
   const rootEmail='compiled-root-'+id.slice(0,8)+'@example.invalid';
   const memberEmail='compiled-member-'+id.slice(0,8)+'@example.invalid';
   const memberPassword='Compiled-Member-Strong-2026';
   const requestKey=randomUUID();
   const headers={Origin:origin,'Content-Type':'application/json',Cookie:cookie};
   const registrationInput=(address)=>({
    email:address,mobile:'+91'+randomInt(1_000_000_000,10_000_000_000),
    displayName:'Compiled Journey Member',password:memberPassword,
    termsVersion:release.build_env.MEMBER_TERMS_VERSION,
    privacyVersion:release.build_env.MEMBER_PRIVACY_VERSION,
    consent:true,communicationOptIn:false
   });
   try{
    assert.equal((await db.matrixPosition.count()),0,
     'Full-stack journey must start from a fresh disposable placement state');
    const createdRoot=await fetch(origin+'/api/admin/backend/cms/membership/root',{
     method:'POST',headers,
     body:JSON.stringify({...registrationInput(rootEmail),applicantPresent:true})
    });
    assert.equal(createdRoot.status,201,'Compiled Admin root bootstrap failed: '+
     (await createdRoot.clone().text()).slice(0,180));
    const rootAccount=await createdRoot.json();
    assert.equal(rootAccount.status,'APPROVED','Admin root must activate immediately');
    const rootRecord=await db.memberAccount.findUniqueOrThrow({where:{email:rootEmail}});
    assert.match(rootRecord.referralCode,/^[A-Z0-9]{8}$/,'Root referral must be eight characters');

    const issue=await fetch(origin+'/api/admin/backend/cms/membership/registration-pins',{
     method:'POST',headers,
     body:JSON.stringify({quantity:1,requestKey})
    });
    assert.equal(issue.status,201,'Compiled Admin E-PIN issue failed: '+
     (await issue.clone().text()).slice(0,180));
    const issued=await issue.json();
    assert.equal(issued.codes?.length,1,'Exactly one PIN expected');
    assert.equal(issued.expiresAt,null,'Compiled registration PIN must have no expiry');
    // Compiled client-review cannot count old access PINs as paid receipts.
    const summaryEndpoint=origin+'/api/admin/backend/cms/membership/registration-pins/paid-summary';
    assert.equal((await fetch(summaryEndpoint)).status,401,
     'Anonymous Admin paid ledger access was allowed');
    const paidSummary=await fetch(summaryEndpoint,{headers:{Cookie:cookie}});
    assert.equal(paidSummary.status,200,'Compiled paid summary BFF unavailable');
    const paidTotals=await paidSummary.json();
    assert.equal(paidTotals.grossPaidPaise,0,'Legacy E-PINs cannot count as paid');
    assert.equal(paidTotals.paidPinCount,0);
    const heldPaid=await fetch(origin+'/api/admin/backend/cms/membership/registration-pins/verified-paid',{
     method:'POST',headers,
     body:JSON.stringify({requestKey:randomUUID(),quantity:1,
      verifiedAmountPaise:1_500_000,paymentVerified:true,
      bankReference:'HELDCOMP_'+id.slice(0,8).toUpperCase(),
      evidenceRef:'HELDRECEIPT_'+id.slice(0,8).toUpperCase(),
      receivedAt:new Date(Date.now()-60_000).toISOString()})
    });
    assert.equal(heldPaid.status,503,'Client review allowed paid PIN issuance');
    assert.equal(await db.registrationPinPaidBatch.count(),0,
     'Compiled client review created a paid receipt despite release HOLD');
    const issuedRecord=await db.registrationPin.findFirstOrThrow({where:{batchId:issued.batchId}});
    assert.equal(issuedRecord.expiresAt,null,'Compiled database must store a real no-expiry PIN');
    const signup=await fetch(origin+'/api/member/session/register',{
     method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
     body:JSON.stringify({...registrationInput(memberEmail),
      registrationPin:issued.codes[0],inviteCode:rootRecord.referralCode})
    });
    assert.equal(signup.status,201,'Compiled public E-PIN registration failed: '+
     (await signup.clone().text()).slice(0,180));
    const enrolled=await signup.json();
    assert.equal(enrolled.status,'APPROVED','Valid E-PIN must immediately activate');
    const member=await db.memberAccount.findUniqueOrThrow({where:{email:memberEmail}});
    assert.equal(member.status,'ACTIVE');
    assert.match(member.referralCode,/^[A-Z0-9]{8}$/);
    const placement=await db.matrixPosition.findUniqueOrThrow({
     where:{entryKey:'ORIGINAL:'+member.id}
    });
    assert.equal(placement.sequence,2,'New member must occupy next global BFS slot');
    const attributed=await db.memberInvitation.findUniqueOrThrow({where:{inviteeId:member.id}});
    assert.equal(attributed.inviterId,rootRecord.id,'Referral attribution must be independent');

    const loginMember=await fetch(origin+'/api/member/session/login',{
     method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
     body:JSON.stringify({identifier:member.referralCode,password:memberPassword})
    });
    assert.equal(loginMember.status,200,'Compiled member referral-code login failed');
    const memberCookie=(loginMember.headers.get('set-cookie')||'').split(';')[0];
    assert.match(memberCookie,/^nisvartha_member_access=/);
    const home=await fetch(origin+'/member',{headers:{Cookie:memberCookie}});
    assert.equal(home.status,200,'Authenticated member dashboard unavailable');
    const dashboardMarkup=await home.text();
    for(const expected of [member.referralCode,'Wallet &amp; payouts','1:3 Matrix'])
     assert.ok(dashboardMarkup.includes(expected),
      'Compiled member dashboard missing '+expected);
    // Compiled Member BFF: protected Bank/UPI default and same-origin update.
    const payoutProfileUrl=origin+'/api/member/actions/payout-profile';
    const anonymousProfile=await fetch(payoutProfileUrl);
    assert.equal(anonymousProfile.status,401,'Anonymous payout profile access was allowed');
    const profileSaved=await fetch(payoutProfileUrl,{
     method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:memberCookie},
     body:JSON.stringify({defaultMethod:'UPI',upiId:'compiled.member@okbank'})
    });
    assert.equal(profileSaved.status,200,'Compiled payout profile save failed: '+
     (await profileSaved.clone().text()).slice(0,180));
    const profileDetails=await fetch(payoutProfileUrl,{headers:{Cookie:memberCookie}});
    assert.equal(profileDetails.status,200,'Compiled payout profile read failed');
    const masked=await profileDetails.json();
    assert.equal(masked.defaultMethod,'UPI');
    assert.equal(masked.upiMask,'UPI ••••@okbank');
    assert.equal(JSON.stringify(masked).includes('compiled.member@okbank'),false,
     'Compiled profile exposed full UPI ID');
    const forgedProfile=await fetch(payoutProfileUrl,{method:'POST',
     headers:{Origin:'https://attacker.invalid','Content-Type':'application/json',Cookie:memberCookie},
     body:JSON.stringify({defaultMethod:'UPI',upiId:'forged.member@okbank'})});
    assert.equal(forgedProfile.status,403,'Cross-origin payout profile update was accepted');
    const matrix=await fetch(origin+'/api/admin/backend/cms/membership/matrix/'+member.id,{
     headers:{Cookie:cookie}
    });
    assert.equal(matrix.status,200,'Admin member matrix inspector unavailable');
    const tree=await matrix.json();
    assert.equal(tree.root?.memberId,member.id);
    const wallet=await fetch(origin+'/member',{headers:{Cookie:memberCookie}});
    assert.equal(wallet.status,200,'Wallet-enabled member dashboard crashed');
    assert.equal((await db.memberOfflineSale.count()),0,
     'Registration must not invent external sale receipts');
    assert.equal((await db.memberEarning.count()),0,
     'Registration must not fabricate financial liabilities');
    // Admin-only identity corrections are audited and revoke existing sessions.
    const correctedEmail='corrected-'+id.slice(0,8)+'@example.invalid';
    const correctedMobile='+91'+randomInt(1_000_000_000,10_000_000_000);
    const identityPath=origin+'/api/admin/backend/cms/membership/members/'+member.id+'/identity';
    const identityInput={email:correctedEmail,mobile:correctedMobile,
     reason:'Member contact independently verified for release UAT'};
    const unauthIdentity=await fetch(identityPath,{method:'PATCH',
     headers:{Origin:origin,'Content-Type':'application/json'},
     body:JSON.stringify(identityInput)});
    assert.equal(unauthIdentity.status,401,'Anonymous Admin identity correction was allowed');
    const corrected=await fetch(identityPath,{method:'PATCH',headers,
     body:JSON.stringify(identityInput)});
    assert.equal(corrected.status,200,'Admin contact correction failed: '+
     (await corrected.clone().text()).slice(0,180));
    const correctedMember=await db.memberAccount.findUniqueOrThrow({where:{id:member.id}});
    assert.equal(correctedMember.email,correctedEmail);
    assert.equal(correctedMember.mobile,correctedMobile);
    assert.equal(correctedMember.referralCode,member.referralCode,
     'Contact correction must not rotate the permanent inviter code');
    assert.equal((await db.matrixPosition.findUniqueOrThrow({
     where:{entryKey:'ORIGINAL:'+member.id}
    })).sequence,2,'Contact correction must not re-place the member');
    assert.equal((await db.memberSession.count({where:{
     memberId:member.id,revokedAt:null
    }})),0,'Correcting contact details must revoke all existing sessions');
    assert.equal((await db.cmsAudit.count({where:{
     actorId:id,objectType:'MEMBER_ACCOUNT',objectId:member.id,
     action:'MEMBER_CONTACT_CORRECTED'
    }})),1,'Contact change must have a durable staff audit');
    const duplicateMobile=await fetch(origin+'/api/admin/backend/cms/membership/members/'+
     rootRecord.id+'/identity',{method:'PATCH',headers,
     body:JSON.stringify({mobile:correctedMobile,reason:'Reject mobile owned by another member'})});
    assert.equal(duplicateMobile.status,409,'Duplicate mobile was not blocked by database');
    const duplicateEmail=await fetch(origin+'/api/admin/backend/cms/membership/members/'+
     rootRecord.id+'/identity',{method:'PATCH',headers,
     body:JSON.stringify({email:correctedEmail,reason:'Reject email owned by another member'})});
    assert.equal(duplicateEmail.status,409,'Duplicate email was not blocked by database');
    const oldSession=await fetch(origin+'/member',{redirect:'manual',
     headers:{Cookie:memberCookie}});
    assert.ok([307,308].includes(oldSession.status),
     'Contact correction failed to invalidate existing member session');

    const replay=await fetch(origin+'/api/member/session/register',{
     method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
     body:JSON.stringify({...registrationInput('replay-'+id.slice(0,8)+'@example.invalid'),
      registrationPin:issued.codes[0],inviteCode:rootRecord.referralCode})
    });
    assert.equal(replay.status,400,'Used E-PIN accepted for a second registration');
   }finally{
    const members=await db.memberAccount.findMany({
     where:{email:{in:[rootEmail,memberEmail,'corrected-'+id.slice(0,8)+'@example.invalid']}},select:{id:true}
    });
    const memberIds=members.map(x=>x.id);
    const batches=await db.registrationPinBatch.findMany({
     where:{requestKey},select:{id:true}
    });
    const batchIds=batches.map(x=>x.id);
    if(memberIds.length){
     await db.memberSession.deleteMany({where:{memberId:{in:memberIds}}});
     await db.memberAudit.deleteMany({where:{memberId:{in:memberIds}}});
     const positions=await db.matrixPosition.findMany({
      where:{memberId:{in:memberIds}},orderBy:{sequence:'desc'},select:{id:true}
     });
     for(const position of positions)await db.matrixPosition.delete({where:{id:position.id}});
     await db.matrixState.update({where:{id:1},data:{nextSequence:1}});
     await db.memberInvitation.deleteMany({where:{OR:[
      {inviterId:{in:memberIds}},{inviteeId:{in:memberIds}}
     ]}});
    }
    if(batchIds.length){
     await db.registrationPin.deleteMany({where:{batchId:{in:batchIds}}});
     await db.registrationPinBatch.deleteMany({where:{id:{in:batchIds}}});
    }
    if(memberIds.length){
     await db.memberPayoutProfile.deleteMany({where:{memberId:{in:memberIds}}});
     await db.membershipApplication.deleteMany({where:{memberId:{in:memberIds}}});
     await db.memberAccount.deleteMany({where:{id:{in:memberIds}}});
    }
   }
  }finally{
   await db.staffSession.deleteMany({where:{staffId:id}});
   await db.cmsAudit.deleteMany({where:{actorId:id}});
   await db.staffUser.deleteMany({where:{id}});
   await db.$disconnect();
  }
 }
 console.log('Compiled full-stack package: backend ready, Next runtime, '+(clientReview?'member-review without money':'held gates')+', public routes PASS');
}finally{
 for(const child of processes){
  if(!child?.pid||child.exitCode!==null)continue;
  const exit=new Promise(done=>child.once('exit',done));
  try{process.kill(-child.pid,'SIGTERM')}catch{}
  await Promise.race([exit,new Promise(done=>setTimeout(done,2500))]);
  if(child.exitCode===null)try{process.kill(-child.pid,'SIGKILL')}catch{}
 }
}
