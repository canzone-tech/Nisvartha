import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {smokeLocalUat} from './smoke-local-uat.mjs';

// No Docker needed: verify local launcher syntax and security boundaries in
// both CI jobs, plus independent positive/negative HTTP smoke fixtures.
const scripts=['scripts/verify-local.sh','scripts/local-uat.sh','scripts/verify-web-local.sh'];
const syntax=spawnSync('bash',['-n',...scripts],{encoding:'utf8'});
assert.equal(syntax.status,0,'Local shell workflow syntax invalid: '+syntax.stderr);
const verifier=readFileSync(scripts[0],'utf8');
const launcher=readFileSync(scripts[1],'utf8');
const webVerifier=readFileSync(scripts[2],'utf8');
const packageJson=JSON.parse(readFileSync('package.json','utf8'));
const apiWorkflow=readFileSync('.github/workflows/api-ci.yml','utf8');
assert.match(apiWorkflow,/Boot entire synthetic public\/member\/E-PIN and referral UAT stack together/,
 'CI must boot the combined feature path, not just isolated components');
for(const feature of ['NISVARTHA_UAT_MEMBERS','NISVARTHA_UAT_PIN_FLOW',
 'NISVARTHA_UAT_FORMS','NISVARTHA_UAT_PLAN'])
 assert.match(apiWorkflow,new RegExp(feature+': synthetic'),
  'CI launcher must enable '+feature);

assert.match(webVerifier,/npm --prefix frontend run verify/);
assert.match(webVerifier,/node scripts\/smoke-browser\.mjs/);
assert.match(webVerifier,/MEMBER_APPLICATIONS_ENABLED=false/);
assert.match(webVerifier,/FORM_SUBMISSIONS_ENABLED=false/);
assert.doesNotMatch(webVerifier,/docker compose/,'Web verification must work without Docker');
for(const [script,name] of [[verifier,'verify'],[launcher,'UAT']]){
 assert.match(script,/--project-name "\$project"/,
  name+' must isolate Docker Compose project and volumes');
 assert.match(script,/NISVARTHA_VERIFY_DB_PORT/,
  name+' must bind disposable MySQL only to an explicit local port');
 assert.match(script,/install -m 700 scripts\/ci-media-scanner\.sh/,
  name+' must use a separate executable scanner fixture, never chmod tracked code');
 assert.match(script,/MEMBER_APPLICATIONS_ENABLED=false/,
  name+' must leave real member registration disabled');
 assert.match(script,/PUBLIC_CONTENT_APPROVED=false/,
  name+' must not accidentally index unverified Foundation content');
 assert.match(script,/FORM_SUBMISSIONS_ENABLED=false/,
  name+' must not collect real forms under a synthetic privacy notice');
 assert.match(script,/down -v --remove-orphans/,
  name+' must clean only the uniquely named disposable DB');
 assert.doesNotMatch(script,/\b(?:docker|\$\{compose\[@\]\})\s+system\s+prune\b/,
  name+' must never prune unrelated Docker resources');
 assert.doesNotMatch(script,/chmod\s+[0-7]+\s+scripts\/ci-media-scanner\.sh/,
  name+' must not dirty tracked file permissions');
}
assert.match(verifier,/tracked_before/);
assert.match(verifier,/tracked_after/);
assert.match(launcher,/127\.0\.0\.1/);
assert.match(launcher,/staff:bootstrap/);
assert.match(launcher,/smoke-local-uat\.mjs/);
assert.doesNotMatch(launcher,/provision-local-uat-approver\.mjs/,'Second reviewer account must not be provisioned');
assert.match(launcher,/NISVARTHA_UAT_ONESHOT/);
assert.match(launcher,/default_mode=synthetic/,'Interactive synthetic profile must be available');
assert.match(launcher,/NISVARTHA_UAT_FORMS/,'Local forms profile must be configured');
assert.match(launcher,/NISVARTHA_UAT_PIN_FLOW/,'PIN issuance must share member fixture');
assert.match(launcher,/NISVARTHA_UAT_COMPENSATION/,'Offline member-flow mode must be explicit');
assert.match(launcher,/MEMBER_COMPENSATION_ENABLED=true/,'Offline member-flow mode must enable earnings only after validation');
assert.match(launcher,/MATRIX_PLACEMENT_ENABLED=true/,'Offline member-flow mode must enable persistent 1:3 placement');
assert.match(packageJson.scripts['uat:local:member-flow']||'',/NISVARTHA_UAT_COMPENSATION=offline/,
 'Package script must expose one-command offline member-flow browser UAT');
assert.match(packageJson.scripts['uat:local:member-flow']||'',/NISVARTHA_UAT_PIN_FLOW=access/,
 'Offline member-flow UAT must use registration E-PIN access mode, not synthetic PINs');
assert.match(packageJson.scripts['uat:local:member-flow:persistent']||'',/NISVARTHA_UAT_PERSIST=true/,
 'Persistent member-flow UAT must preserve the dedicated local MySQL volume');
assert.match(packageJson.scripts['uat:local:member-flow:persistent']||'',/NISVARTHA_UAT_COMPENSATION=offline/,
 'Persistent member-flow command must exercise the same offline compensation path');
assert.match(packageJson.scripts['acceptance:local:production-like']||'',/NISVARTHA_LOCAL_PROFILE=production-like/,
 'Production-like acceptance must be a dedicated explicit profile');
assert.match(packageJson.scripts['acceptance:local:production-like']||'',/NISVARTHA_UAT_PERSIST=true/,
 'Production-like acceptance must always use persistent MySQL');
assert.match(launcher,/project='nisvartha-production-acceptance'/,
 'Production-like acceptance must not reuse the synthetic UAT Docker project');
assert.match(launcher,/nisvartha-production-acceptance/,
 'Production-like acceptance must keep separate local credentials/state');
assert.match(launcher,/MEMBER_COMPENSATION_APPROVED=true/,
 'Production-like acceptance must explicitly exercise the compensation approval gate');
assert.match(launcher,/NISVARTHA_LOCAL_ADMIN_EMAIL:-local-admin@example\.com/,
 'Production-like acceptance must default to a valid-format Admin email');
assert.match(launcher,/Production-like validation permits normal email formats/,
 'Production-like launcher must state its local valid-email contract');
assert.match(readFileSync('scripts/smoke-local-uat.mjs','utf8'),/local-contact@example\.com/,
 'Production-like smoke must submit a normal-format contact email');
assert.match(readFileSync('scripts/smoke-local-uat.mjs','utf8'),/local-volunteer@example\.com/,
 'Production-like smoke must submit a normal-format volunteer email');
assert.match(launcher,/scripts\/smoke-local-member-invites\.mjs/,
 'Local launcher must verify PIN issue, same-Admin approval and invite on the same runtime');
const integratedSmoke=readFileSync('scripts/smoke-local-member-invites.mjs','utf8');
for(const check of [
 /api\/v1\/members\/genealogy/,
 /cms\/membership\/genealogy/,
 /grandchildEdge\.inviterId/,
 /APPROVED/,
 /Consumed PIN was reused/
])assert.match(integratedSmoke,check,
 'End-to-end direct-referral genealogy acceptance check is missing');
assert.match(launcher,/default_mode=off/,'One-shot local CI must remain fail-closed');
assert.match(launcher,/Offline member-flow UAT is interactive only, not permitted in one-shot CI/,
 'One-shot CI must reject the interactive compensation profile');
assert.match(launcher,/NISVARTHA_UAT_CLIENT_TEMPLATE:-off/,
 'Interactive default must render real Next forms, not static demo rewrites');

assert.equal((launcher.match(/node scripts\/smoke-local-uat\.mjs/g)||[]).length,1,
 'Local UAT must run authenticated integration smoke exactly once after read-only readiness polling');
assert.match(launcher,/single attempt/,'Local UAT should report unambiguous single smoke failure');

let ready=true,leakStaff=false,unsafePlan=false,registered=false,failAuth=false;
let missingExpiryPicker=false;
let privacyIndexed=false;
const email='local-admin@example.invalid',password='Synthetic-Isolated-Staff-Password-2026';
const server=(handler)=>createServer((req,res)=>{
 Promise.resolve(handler(req)).then(({status=200,body='',headers={}})=>{
  res.writeHead(status,headers);res.end(body);
 }).catch(()=>{res.writeHead(500);res.end('Fixture failed')});
});
const json=(value,status=200)=>({status,body:JSON.stringify(value),
 headers:{'Content-Type':'application/json'}});
const apiServer=server(req=>{
 if(req.url==='/api/v1/health/ready')
  return ready?json({status:'ok'}):json({message:'Not ready'},503);
 return json({message:'Not found'},404);
});
const webServer=server(async req=>{
 const path=new URL(req.url,'http://127.0.0.1').pathname;
 if(path==='/robots.txt')
  return {body:privacyIndexed?'User-agent: *\nAllow: /':'User-agent: *\nDisallow: /'};
 if(path==='/auto-pool-plan')
  return {status:200,body:unsafePlan
   ?'<title>Auto Pool Plan — Review Pending</title><p>This prototype is not production copy.</p>'
   :'<title>Auto Pool Plan</title><p>Public enrolment is not processed on this page.</p>'};
 if(path==='/member/register')
  return {status:registered?200:404,body:'Not found'};
 const routes={
  '/admin':'overview',
  '/admin/enquiries':'enquiries','/admin/members':'members',
  '/admin/staff':'staff','/admin/audit':'audit','/admin/epin':'epin',
  '/admin/recovery':'recovery','/admin/matrix':'matrix'
 };
 if(Object.hasOwn(routes,path)&&!req.headers.cookie)
  return {status:307,headers:{Location:'/admin/login'}};
 if(Object.hasOwn(routes,path)){
  if(path==='/admin'){
   const legacy=new URL(req.url,'http://127.0.0.1').searchParams.get('view');
   const oldToNew={overview:'/admin',content:'/admin',
    media:'/admin',enquiries:'/admin/enquiries',
    members:'/admin/members',staff:'/admin/staff',
    audit:'/admin/audit',epin:'/admin/epin',recovery:'/admin/recovery'};
   if(legacy&&Object.hasOwn(oldToNew,legacy))
    return {status:307,headers:{Location:oldToNew[legacy]}};
  }
  const view=routes[path];
  const headings={
   overview:'Member operations at a glance',
   enquiries:'Contact & volunteer enquiries',
   members:'Membership applications',
   staff:'Administrator security',
   audit:'Recent administrative audit',
   epin:'E-PIN inventory',
   recovery:'Member recovery',matrix:'Matrix & rebirth preview'
  };
  const pinsEnabled=process.env.NISVARTHA_UAT_PIN_FLOW==='synthetic'||
   process.env.NISVARTHA_UAT_PIN_FLOW==='access';
  const expiryPicker=view==='epin'&&pinsEnabled&&!missingExpiryPicker
   ?'<label>Expiry date and time<input type="datetime-local" required></label>':'';
  const disabledNotice=view==='epin'&&!pinsEnabled
   ?'<p>Registration E-PINs are disabled</p>':'';
  return {body:'<main data-workspace-view="'+view+'"><nav aria-label="Workspace navigation"><a href="/admin/members">Members</a><a href="/admin/epin">E-PIN inventory</a></nav><section><h1>'+headings[view]+'</h1>'+expiryPicker+disabledNotice+'</section></main>'};
 }
 if(path==='/api/admin/backend/staff/me'){
  if(leakStaff||req.headers.cookie==='nisvartha_staff_access=testtoken')
   return json({email,role:'ADMIN'});
  return json({message:'Not signed in'},401);
 }
 if(path==='/api/admin/session/login'&&req.method==='POST'){
  let body='';for await(const chunk of req)body+=String(chunk);
  const input=JSON.parse(body);
  if(failAuth||input.email!==email||input.password!==password)
   return json({message:'Login failed'},401);
  return {...json({user:{email,role:'ADMIN'}}),headers:{
   'Content-Type':'application/json',
   'Set-Cookie':'nisvartha_staff_access=testtoken; HttpOnly; SameSite=Strict; Path=/'
  }};
 }
 if(['/','/about','/projects','/go-green','/contact','/admin/login'].includes(path))
  return {body:'<!doctype html><h1>Synthetic local UAT web route</h1>'};
 return {status:404,body:'Not found'};
});
const start=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
await Promise.all([start(apiServer),start(webServer)]);
const api='http://127.0.0.1:'+apiServer.address().port;
const web='http://127.0.0.1:'+webServer.address().port;
const expectFails=async(reason)=>{
 await assert.rejects(smokeLocalUat(web,api,email,password),Error,reason);
};
const previousPinMode=process.env.NISVARTHA_UAT_PIN_FLOW;
process.env.NISVARTHA_UAT_PIN_FLOW='off';
try{
 assert.equal((await smokeLocalUat(web,api,email,password)).passed,true);
 process.env.NISVARTHA_UAT_PIN_FLOW='synthetic';
 assert.equal((await smokeLocalUat(web,api,email,password)).passed,true);
 process.env.NISVARTHA_UAT_PIN_FLOW='off';
 assert.equal((await smokeLocalUat(web,api,email,password)).passed,true);
 ready=false;await expectFails('Not-ready API cannot pass local UAT');ready=true;
 leakStaff=true;await expectFails('Public staff BFF must never pass');leakStaff=false;
 unsafePlan=true;await expectFails('Test-era Auto Pool copy must not pass');unsafePlan=false;
 registered=true;await expectFails('Unapproved member registration must not pass');registered=false;
 privacyIndexed=true;await expectFails('Unverified content must remain noindex');privacyIndexed=false;
 failAuth=true;await expectFails('Broken staff browser login must not pass');failAuth=false;
 process.env.NISVARTHA_UAT_PIN_FLOW='access';
 assert.equal((await smokeLocalUat(web,api,email,password)).passed,true);
 missingExpiryPicker=true;
 await expectFails('Missing E-PIN calendar picker must fail local UAT');
 missingExpiryPicker=false;
 process.env.NISVARTHA_UAT_PIN_FLOW='off';
 await assert.rejects(smokeLocalUat('https://example.com',api,email,password),
  Error,'Public origin not allowed in local synthetic smoke');
 await assert.rejects(smokeLocalUat(web,api,'real@example.com',password),
  Error,'Local smoke must use a synthetic email');
 console.log('Nisvartha local launcher: bash syntax, Docker isolation, held gates, synthetic compiled staff BFF smoke contracts PASS');
}finally{
 if(previousPinMode===undefined)delete process.env.NISVARTHA_UAT_PIN_FLOW;
 else process.env.NISVARTHA_UAT_PIN_FLOW=previousPinMode;
 await Promise.all([new Promise(resolve=>apiServer.close(resolve)),
  new Promise(resolve=>webServer.close(resolve))]);
}


const persistentLauncher=readFileSync('scripts/local-uat.sh','utf8');
const persistentCompose=readFileSync('infra/compose.uat-persistent.yml','utf8');
assert.match(persistentLauncher,/NISVARTHA_UAT_PERSIST/,'Local persistence must be opt-in');
assert.match(persistentLauncher,/down --remove-orphans/,'Persistent local stop must not delete volume');
assert.match(persistentLauncher,/pin-vault\.key/,'Persistent PINs need stable local vault key');
assert.match(persistentLauncher,/admin-password/,'Persistent Admin login needs stable credentials');
assert.match(persistentCompose,/nisvartha_local_uat_data:\/var\/lib\/mysql/,
 'Persisted local UAT needs a separately named MySQL volume');
