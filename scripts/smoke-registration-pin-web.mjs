import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const db=new (require('@prisma/client').PrismaClient)();
const argon2=require('argon2');
if(new URL(process.env.DATABASE_URL||'mysql://invalid/unknown').pathname!=='/nisvartha_ci')
 throw Error('Real registration access web smoke requires isolated MySQL');
const alloc=()=>new Promise((resolve,reject)=>{
 const s=createServer();s.once('error',reject);
 s.listen(0,'127.0.0.1',()=>{const a=s.address();if(!a||typeof a==='string')return reject(Error('Port unavailable'));s.close(()=>resolve(a.port))})
});
const apiPort=await alloc(),webPort=await alloc();
const api='http://127.0.0.1:'+apiPort+'/api/v1',web='http://127.0.0.1:'+webPort;
const staffId=randomUUID(),memberIds=[],batchIds=[];
const staffEmail='uat-web-admin-'+staffId.slice(0,8)+'@example.invalid';
const staffPassword='Uat-Browser-Admin-Password-2026';
const accountPassword='Uat-Browser-Member-Password-2026';
const env={...process.env,NODE_ENV:'',
 NISVARTHA_UAT_PIN_REGISTRATION:'false',REGISTRATION_ACCESS_PIN_ENABLED:'true',
 MEMBER_PORTAL_ENABLED:'true',MEMBER_APPLICATIONS_ENABLED:'true',
 MEMBER_STAFF_REGISTRATION_ENABLED:'true',MEMBER_TERMS_VERSION:'ci-terms',
 MEMBER_PRIVACY_VERSION:'ci-privacy'};
const ready=async url=>{
 for(let i=0;i<80;i++){try{const r=await fetch(url);if(r.ok)return}catch{}await new Promise(ok=>setTimeout(ok,200))}
 throw Error('Compiled UAT runtime not ready: '+url);
};
const post=async(path,body,cookie,origin=web)=>fetch(web+path,{method:'POST',
 headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},
 body:JSON.stringify(body)});
let backend,frontend;
try{
 const hash=await argon2.hash(staffPassword,{
  type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1
 });
 await db.staffUser.create({data:{id:staffId,email:staffEmail,
  displayName:'Synthetic Web Admin',passwordHash:hash,role:'ADMIN'}});
 backend=spawn(process.execPath,['backend/dist/main.js'],{env:{...env,PORT:String(apiPort)},
  stdio:'ignore',detached:true});
 await ready(api+'/health/ready');
 frontend=spawn('npm',['--prefix','frontend','run','start','--','-p',String(webPort)],{
  env:{...env,API_INTERNAL_URL:'http://127.0.0.1:'+apiPort},stdio:'ignore',detached:true
 });
 await ready(web);
 const publicPage=await fetch(web+'/member/register');
 assert.equal(publicPage.status,200);
 const publicRegistrationHtml=await publicPage.text();
 assert.match(publicRegistrationHtml,/Registration E-PIN/,
  'Compiled public registration missing required registration PIN field');
 assert.doesNotMatch(publicRegistrationHtml,/(Nonfinancial|Synthetic|UAT|prototype|demo)/i,
  'Test-era copy leaked into member registration');
 const memberLoginPage=await fetch(web+'/member/login');
 assert.equal(memberLoginPage.status,200);
 assert.doesNotMatch(await memberLoginPage.text(),/(Nonfinancial|Synthetic|UAT|prototype|demo)/i,
  'Test-era copy leaked into member sign in');
 const signin=await post('/api/admin/session/login',{email:staffEmail,password:staffPassword});
 assert.equal(signin.status,200);
 const cookie=(signin.headers.get('set-cookie')||'').split(';')[0];
 const adminPage=await fetch(web+'/admin/epin',{headers:{Cookie:cookie}});
 assert.equal(adminPage.status,200);
 const html=await adminPage.text();
 assert.match(html,/Registration E-PIN inventory/);
 assert.doesNotMatch(html,/(Nonfinancial|Synthetic|UAT|prototype|demo)/i,
  'Test-era copy leaked into production registration E-PIN workspace');
 assert.doesNotMatch(html,/Registration E-PIN policy preview/,
  'Duplicate policy-only form rendered in Admin E-PIN page');
 assert.match(html,/Create registration E-PINs/);
 const membersPage=await fetch(web+'/admin/members',{headers:{Cookie:cookie}});
 const membersHtml=await membersPage.text();
 assert.match(membersHtml,/Register member \(staff-assisted\)/);
 assert.doesNotMatch(membersHtml,/(Nonfinancial|Synthetic|UAT|prototype|demo)/i,
  'Test-era copy leaked into production member workspace');
 assert.equal((await post('/api/admin/backend/cms/membership/registration-pins',{})).status,401,
  'Unauthenticated BFF issued PINs');
 assert.equal((await post('/api/admin/backend/cms/membership/registration-pins',{},cookie,'https://forged.invalid')).status,403,
  'Cross-origin PIN issuance accepted');
 const issue=await post('/api/admin/backend/cms/membership/registration-pins',{
  quantity:2,expiresAt:'2099-01-31T23:59:00+05:30',requestKey:randomUUID()
 },cookie);
 assert.equal(issue.status,201,'BFF issue failed '+(await issue.clone().text()).slice(0,200));
 const issued=await issue.json();
 assert.equal(issued.codes.length,2);
 assert.equal(issued.classification,'REGISTRATION_ACCESS');
 batchIds.push(issued.batchId);
 assert.equal((await post('/api/admin/backend/cms/membership/registration-pins',{},cookie,'https://forged.invalid')).status,403,
  'Cross-origin real PIN issuance accepted');
 const available=await fetch(web+'/api/admin/backend/cms/membership/registration-pins?status=AVAILABLE',{headers:{Cookie:cookie}});
 assert.equal(available.status,200);
 const availableData=await available.json();
 assert.equal(availableData.items.filter(x=>x.batchId===issued.batchId).length,2);
 assert.ok(availableData.items.every(x=>!('tokenHash' in x)&&!('codes' in x)));
 assert.deepEqual(new Set(availableData.items.filter(x=>x.batchId===issued.batchId).map(x=>x.code)),
  new Set(issued.codes),'Admin inventory must display full PINs after reload through the BFF');
 assert.equal((await fetch(web+'/api/admin/backend/cms/membership/registration-pins?status=UNKNOWN',{headers:{Cookie:cookie}})).status,400);
 assert.equal((await fetch(web+'/api/admin/backend/cms/membership/registration-pins?status=USED&status=AVAILABLE',{headers:{Cookie:cookie}})).status,400);
 assert.equal((await fetch(web+'/api/admin/backend/cms/membership/registration-pins?unknown=1',{headers:{Cookie:cookie}})).status,400);
 const overview=await fetch(web+'/api/admin/backend/staff/overview',{headers:{Cookie:cookie}});
 assert.equal(overview.status,200,'Admin dashboard API not reachable through BFF');
 assert.equal(typeof (await overview.json()).pendingApplications,'number');
 const form={email:'uat-public-'+randomUUID().slice(0,8)+'@example.invalid',
  displayName:'Synthetic Applicant',password:accountPassword,
  termsVersion:'ci-terms',privacyVersion:'ci-privacy',
  communicationOptIn:false,consent:true,registrationPin:'  '+issued.codes[0]+'\n'};
 const publicCreated=await post('/api/member/session/register',form);
 assert.equal(publicCreated.status,201,'Public copied PIN signup failed '+(await publicCreated.clone().text()).slice(0,200));
 const created=await publicCreated.json();memberIds.push(created.id);
 assert.equal(created.status,'SUBMITTED');
 const reviewBase='/api/admin/backend/cms/membership/applications/'+created.applicationReference;
 assert.equal((await post(reviewBase+'/review',{},cookie)).status,200,
  'Single ADMIN could not review public applicant');
 assert.equal((await post(reviewBase+'/decide',{
  status:'APPROVED',reason:'Registration E-PIN invitation acceptance test'
 },cookie)).status,200,'Single ADMIN could not approve inviter');
 const sponsor=await db.memberAccount.findUniqueOrThrow({where:{id:created.id}});
 const inviteRegistration=await fetch(web+'/member/register?invite='+sponsor.referralCode);
 assert.equal(inviteRegistration.status,200);
 const inviteHtml=await inviteRegistration.text();
 assert.match(inviteHtml,new RegExp('name="inviteCode"[^>]*value="'+sponsor.referralCode+'"'),
  'Actual registration E-PIN signup did not prefill approved inviter');
 const memberLogin=await post('/api/member/session/login',{
  email:form.email,password:accountPassword
 });
 assert.equal(memberLogin.status,200,'Approved member BFF login failed');
 const memberCookie=(memberLogin.headers.get('set-cookie')||'').split(';')[0];
 assert.match(memberCookie,/nisvartha_member_access=/);
 const approvedMemberPage=await fetch(web+'/member',{headers:{Cookie:memberCookie}});
 assert.equal(approvedMemberPage.status,200);
 const memberHtml=await approvedMemberPage.text();
 assert.match(memberHtml,/Share your invitation/,
  'Real registration E-PIN member dashboard does not expose approved invite link');
 const assisted=await post('/api/admin/backend/cms/membership/applications/register',{
  ...form,email:'uat-assisted-'+randomUUID().slice(0,8)+'@example.invalid',
  registrationPin:issued.codes[1],inviteCode:sponsor.referralCode,applicantPresent:true
 },cookie);
 assert.equal(assisted.status,201,'Admin assisted code signup failed '+(await assisted.clone().text()).slice(0,200));
 const staffCreated=await assisted.json();memberIds.push(staffCreated.id);
 assert.equal(staffCreated.status,'SUBMITTED');
 const edge=await db.memberInvitation.findUniqueOrThrow({where:{inviteeId:staffCreated.id}});
 assert.equal(edge.inviterId,sponsor.id,
  'Staff-assisted registration E-PIN signup did not persist direct inviter');
 const memberAfterInvitation=await fetch(web+'/member',{headers:{Cookie:memberCookie}});
 assert.equal(memberAfterInvitation.status,200);
 assert.match(await memberAfterInvitation.text(),/Attributed applications/,
  'Member dashboard invitation count label unavailable');
 const claimedAgain=await post('/api/member/session/register',{
  ...form,email:'reuse-'+randomUUID().slice(0,8)+'@example.invalid'});
 assert.equal(claimedAgain.status,400,'Real PIN replay accepted through public web BFF');
 const records=await db.registrationPin.findMany({where:{batchId:issued.batchId}});
 assert.equal(records.filter(x=>x.redeemedAt).length,2);
 assert.deepEqual(new Set(records.map(x=>x.redeemedByMemberId)),new Set(memberIds));
 const used=await fetch(web+'/api/admin/backend/cms/membership/registration-pins?status=USED',{headers:{Cookie:cookie}});
 assert.equal(used.status,200);
 const usedData=await used.json();
 assert.equal(usedData.items.filter(x=>x.batchId===issued.batchId).length,2);
 assert.ok(usedData.items.every(x=>x.status==='USED'));
 assert.ok(usedData.items.filter(x=>x.batchId===issued.batchId).every(x=>issued.codes.includes(x.code)),
  'Admin inventory must continue showing full PINs after member redemption');
 const mismatchedCursor=await fetch(web+'/api/admin/backend/cms/membership/registration-pins?status=AVAILABLE&cursor='+usedData.items.find(x=>x.batchId===issued.batchId).id,{headers:{Cookie:cookie}});
 assert.equal(mismatchedCursor.status,400,'Used-PIN cursor accepted for available PINs');
 console.log('Compiled Next.js registration E-PIN PIN, approved invite link, staff attribution and member dashboard: PASS');
}finally{
 for(const child of [frontend,backend])if(child?.pid){
  const done=new Promise(r=>child.once('exit',r));try{process.kill(-child.pid,'SIGTERM')}catch{}
  await Promise.race([done,new Promise(r=>setTimeout(r,2000))]);
 }
 await db.memberInvitation.deleteMany({where:{OR:[
  {inviterId:{in:memberIds}},{inviteeId:{in:memberIds}}
 ]}});
 await db.registrationPin.deleteMany({where:{batchId:{in:batchIds}}});
 await db.registrationPinBatch.deleteMany({where:{id:{in:batchIds}}});
 await db.membershipApplication.deleteMany({where:{memberId:{in:memberIds}}});
 await db.memberSession.deleteMany({where:{memberId:{in:memberIds}}});
 await db.memberAudit.deleteMany({where:{memberId:{in:memberIds}}});
 await db.memberAccount.deleteMany({where:{id:{in:memberIds}}});
 await db.cmsAudit.deleteMany({where:{actorId:staffId}});
 await db.staffSession.deleteMany({where:{staffId}});
 await db.staffUser.deleteMany({where:{id:staffId}});
 await db.$disconnect();
}
