import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {createServer} from 'node:net';
import {resolve,join} from 'node:path';
const root=resolve(process.argv[2]||'dist/client-preview');
const start=join(root,'server.js');
assert.ok(existsSync(start),'Compiled standalone server.js missing');
assert.ok(existsSync(join(root,'.next','static')),'Compiled static assets missing');
assert.ok(existsSync(join(root,'public')),'Client public assets missing');
for(const item of ['.git','src','app','lib','components']){
 assert.ok(!existsSync(join(root,item)),'Source tree leaked into preview: '+item);
}
assert.ok(!existsSync(join(root,'public','client-template')),
 'Local-only exact HTML client template must not be included');
const port=await new Promise((done,reject)=>{
 const s=createServer();s.once('error',reject);
 s.listen(0,'127.0.0.1',()=>{const addr=s.address();
  if(!addr||typeof addr==='string')return reject(Error('Port unavailable'));
  s.close(()=>done(addr.port));
 });
});
const child=spawn(process.execPath,[start],{cwd:root,detached:true,
 stdio:['ignore','ignore','pipe'],env:{...process.env,
  NODE_ENV:'production',HOSTNAME:'127.0.0.1',PORT:String(port),
  NISVARTHA_CLIENT_TEMPLATE_PREVIEW:'false',
  NISVARTHA_UAT_PIN_REGISTRATION:'false',NISVARTHA_UAT_PLAN:'off',
  MEMBER_PORTAL_ENABLED:'false',MEMBER_APPLICATIONS_ENABLED:'false',
  MEMBER_STAFF_REGISTRATION_ENABLED:'false',MEMBER_RECOVERY_ENABLED:'false'}});
let stderr='';
child.stderr?.on('data',part=>{stderr=(stderr+part.toString()).slice(-2000)});
const base='http://127.0.0.1:'+port;
const get=path=>fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(2500)});
try{
 let ready=false;
 for(let n=0;n<100;n++){
  if(child.exitCode!==null)throw Error('Standalone server exited: '+stderr);
  try{if((await get('/')).status===200){ready=true;break}}catch{}
  await new Promise(done=>setTimeout(done,150));
 }
 assert.ok(ready,'Standalone server readiness failed: '+stderr);
 const pages=['/','/about','/activities','/go-green','/projects','/volunteer',
  '/donate','/membership','/gallery','/news-events','/contact',
  '/faq','/how-it-works','/login','/register','/privacy-policy','/terms'];
 for(const path of pages){
  const r=await get(path);assert.equal(r.status,200,'Public route failed: '+path);
  assert.match(await r.text(),/nisvartha/i,'Brand copy missing on '+path);
 }
 const robots=await get('/robots.txt');assert.equal(robots.status,200);
 assert.match(await robots.text(),/Disallow:\s*\//i,'Preview robots must be noindex');
 for(const path of ['/auto-pool-plan','/member/register',
  '/client-template/auto-pool-plan.html','/api/v1/staff/accounts']){
  assert.equal((await get(path)).status,404,'Held route exposed: '+path);
 }
 const home=await (await get('/')).text();
 const script=home.match(/\/_next\/static\/[^"'\s<>]+\.js/);
 assert.ok(script,'Missing client JS reference');
 assert.equal((await get(script[0].replaceAll('&amp;','&'))).status,200,
  'Compiled JS missing');
 console.log('Client preview standalone smoke: PASS (17 pages, held routes, noindex, static JS)');
}finally{
 if(child.pid){
  const exit=new Promise(done=>child.once('exit',done));
  try{process.kill(-child.pid,'SIGTERM')}catch{}
  await Promise.race([exit,new Promise(done=>setTimeout(done,2500))]);
  if(child.exitCode===null)try{process.kill(-child.pid,'SIGKILL')}catch{}
 }
}
