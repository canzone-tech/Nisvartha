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
 const unauthenticated=await fetch(base+'/api/admin/backend/cms/contents');
 assert.equal(unauthenticated.status,401,'Admin BFF must deny missing session');
 const badOrigin=await fetch(base+'/api/admin/session/login',{method:'POST',headers:{'Origin':'https://untrusted.example','Content-Type':'application/json'},body:'{}'});
 assert.equal(badOrigin.status,403,'Cross-origin admin login denied');
 const blocked=await fetch(base+'/auto-pool-plan');
 assert.equal(blocked.status,404,'Compensation plan must remain unpublished');
 console.log('Nisvartha web route smoke: PASS');
}finally{
 try{process.kill(-server.pid,'SIGTERM');}catch{}
}
