import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
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
const expectedBuildEnvKeys=[
 'NEXT_PUBLIC_SITE_URL','NEXT_PUBLIC_API_URL','PUBLIC_CONTENT_APPROVED',
 'CMS_PUBLIC_CONTENT_ENABLED','NEXT_PUBLIC_FORMS_ENABLED',
 'NEXT_PUBLIC_PRIVACY_APPROVED','MEMBER_PORTAL_ENABLED',
 'MEMBER_APPLICATIONS_ENABLED','MEMBER_STAFF_REGISTRATION_ENABLED',
 'MEMBER_RECOVERY_ENABLED','REGISTRATION_ACCESS_PIN_ENABLED',
 'MATRIX_PLACEMENT_ENABLED','MEMBER_COMPENSATION_ENABLED',
 'MEMBER_TERMS_VERSION','MEMBER_PRIVACY_VERSION'
];
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
const env={...process.env,NODE_ENV:'production',HOST:'127.0.0.1',HOSTNAME:'127.0.0.1',
 MEMBER_PORTAL_ENABLED:'false',MEMBER_APPLICATIONS_ENABLED:'false',
 MEMBER_STAFF_REGISTRATION_ENABLED:'false',REGISTRATION_ACCESS_PIN_ENABLED:'false',
 MATRIX_PLACEMENT_ENABLED:'false',MEMBER_COMPENSATION_ENABLED:'false',
 NISVARTHA_UAT_PIN_REGISTRATION:'false',NISVARTHA_UAT_PLAN:'off'};
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
 assert.equal((await fetch(origin+'/member/register')).status,404);
 assert.equal((await fetch(origin+'/auto-pool-plan')).status,404);
 const admin=await fetch(origin+'/admin',{redirect:'manual'});
 assert.equal(admin.status,307,'Anonymous admin did not redirect');
 const anonymous=await fetch(origin+'/api/admin/backend/staff/me',{redirect:'manual'});
 assert.equal(anonymous.status,401,'Anonymous staff BFF was exposed');
 console.log('Compiled full-stack package: backend liveness, Next runtime, held gates, public routes PASS');
}finally{
 for(const child of processes){
  if(!child?.pid||child.exitCode!==null)continue;
  const exit=new Promise(done=>child.once('exit',done));
  try{process.kill(-child.pid,'SIGTERM')}catch{}
  await Promise.race([exit,new Promise(done=>setTimeout(done,2500))]);
  if(child.exitCode===null)try{process.kill(-child.pid,'SIGKILL')}catch{}
 }
}
