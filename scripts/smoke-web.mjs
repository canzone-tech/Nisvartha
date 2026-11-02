import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const port = await new Promise((resolve,reject)=>{
 const server=createServer();
 server.once('error',reject);
 server.listen(0,'127.0.0.1',()=>{
  const address=server.address();
  if(!address || typeof address==='string') return reject(new Error('Invalid port'));
  server.close(()=>resolve(address.port));
 });
});
const base='http://127.0.0.1:'+port;
const server=spawn('npm',['--prefix','frontend','run','start','--','-p',String(port)],{stdio:'ignore',detached:true});
try {
 let healthy=false;
 for(let attempt=0;attempt<50;attempt++){
  if(server.exitCode!==null)throw new Error('Frontend exited before readiness');
  try{const res=await fetch(base+'/');if(res.ok){healthy=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,300));
 }
 assert.ok(healthy,'Frontend startup timed out');
 for(const path of ['/','/about','/projects','/go-green','/volunteer','/contact','/donate','/membership','/privacy-policy','/terms','/admin/login','/robots.txt','/sitemap.xml']){
  const response=await fetch(base+path);
  assert.equal(response.status,200,path+' status');
 }
 for(const path of ['/projects/unknown-unapproved-project','/auto-pool-plan']){
  const missing=await fetch(base+path);
  assert.equal(missing.status,404,'Unapproved material must remain unpublished: '+path);
 }
 const robots=await (await fetch(base+'/robots.txt')).text();
 assert.match(robots,/Disallow:\s*\//,'Search-indexing block must remain in place');
 const contact=await (await fetch(base+'/contact')).text();
 assert.ok(!contact.includes('Send enquiry</button>'),'Forms must be disabled until privacy authorization');
 const projectList=await (await fetch(base+'/projects')).text();
 assert.match(projectList,/Project updates are being reviewed/,'Cannot manufacture project impact claims');
 const admin=await fetch(base+'/admin',{redirect:'manual'});
 assert.equal(admin.status,307,'Uncredentialed admin must redirect');
 assert.equal(admin.headers.get('location'),'/admin/login');
 const blockedPreview=await fetch(base+'/admin/preview/11111111-1111-4111-8111-111111111111',{redirect:'manual'});
 assert.equal(blockedPreview.status,307,'Anonymous staff preview must redirect to login');
 assert.equal(blockedPreview.headers.get('location'),'/admin/login');
 const unauthenticated=await fetch(base+'/api/admin/backend/cms/contents');
 assert.equal(unauthenticated.status,401,'Admin BFF must deny missing session');

 const batchPath=base+'/api/admin/backend/staff/epin-batches/validate';
 const body=JSON.stringify({quantity:2,pinType:'ACTIVATION',expiresAt:'2027-01-01T00:00:00+05:30'});
 const noSession=await fetch(batchPath,{method:'POST',
  headers:{Origin:base,'Content-Type':'application/json'},body});
 assert.equal(noSession.status,401,'E-PIN policy preview must reject anonymous BFF use');
 const crossSite=await fetch(batchPath,{method:'POST',
  headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body});
 assert.equal(crossSite.status,403,'E-PIN policy preview must reject cross-origin POST');

 const badOrigin=await fetch(base+'/api/admin/session/login',{method:'POST',headers:{'Origin':'https://untrusted.example','Content-Type':'application/json'},body:'{}'});
 assert.equal(badOrigin.status,403,'Cross-origin admin login denied');
 for(const route of ['/member','/member/login','/member/register','/member/recover']){
  const unavailable=await fetch(base+route,{redirect:'manual'});
  assert.equal(unavailable.status,404,'Unapproved member portal must be disabled: '+route);
 }
 const gatedRegister=await fetch(base+'/api/member/session/register',{method:'POST',
  headers:{Origin:base,'Content-Type':'application/json'},body:'{}'});
 assert.equal(gatedRegister.status,404,'Disabled portal must reject registration');
 const blocked=await fetch(base+'/auto-pool-plan');
 assert.equal(blocked.status,404,'Compensation plan must remain unpublished');
 console.log('Nisvartha web route smoke: PASS');
}finally{
 try{process.kill(-server.pid,'SIGTERM');}catch{}
}
