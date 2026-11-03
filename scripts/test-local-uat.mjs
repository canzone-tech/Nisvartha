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
assert.match(launcher,/provision-local-uat-approver\.mjs/);
assert.match(launcher,/NISVARTHA_UAT_ONESHOT/);

let ready=true,leakStaff=false,publishedPlan=false,registered=false,failAuth=false;
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
  return {status:publishedPlan?200:404,body:'Not found'};
 if(path==='/member/register')
  return {status:registered?200:404,body:'Not found'};
 if(path==='/admin'&&!req.headers.cookie)
  return {status:307,headers:{Location:'/admin/login'}};
 if(path==='/admin'){
  const requested=new URL(req.url,'http://127.0.0.1').searchParams.get('view');
  const views={
   overview:'Make a difference, one update at a time.',
   content:'Create content draft',
   media:'Media library & gallery',
   enquiries:'Contact & volunteer enquiries',
   members:'Membership applications',
   staff:'Staff accounts & permissions',
   audit:'Recent administrative audit',
   epin:'Registration E-PIN policy preview'
  };
  const view=Object.hasOwn(views,requested)?requested:'overview';
  return {body:'<main data-workspace-view="'+view+'"><nav aria-label="Workspace navigation">Content workspace</nav><section><h1>'+views[view]+'</h1></section></main>'};
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
try{
 assert.equal((await smokeLocalUat(web,api,email,password)).passed,true);
 ready=false;await expectFails('Not-ready API cannot pass local UAT');ready=true;
 leakStaff=true;await expectFails('Public staff BFF must never pass');leakStaff=false;
 publishedPlan=true;await expectFails('Unapproved financial page must not pass');publishedPlan=false;
 registered=true;await expectFails('Unapproved member registration must not pass');registered=false;
 privacyIndexed=true;await expectFails('Unverified content must remain noindex');privacyIndexed=false;
 failAuth=true;await expectFails('Broken staff browser login must not pass');failAuth=false;
 await assert.rejects(smokeLocalUat('https://example.com',api,email,password),
  Error,'Public origin not allowed in local synthetic smoke');
 await assert.rejects(smokeLocalUat(web,api,'real@example.com',password),
  Error,'Local smoke must use a synthetic email');
 console.log('Nisvartha local launcher: bash syntax, Docker isolation, held gates, synthetic compiled staff BFF smoke contracts PASS');
}finally{
 await Promise.all([new Promise(resolve=>apiServer.close(resolve)),
  new Promise(resolve=>webServer.close(resolve))]);
}
