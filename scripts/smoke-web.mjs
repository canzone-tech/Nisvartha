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
 for(const path of ['/','/about','/projects','/go-green','/volunteer','/contact','/donate','/membership','/privacy-policy','/terms','/robots.txt','/sitemap.xml']){
  const response=await fetch(base+path);
  assert.equal(response.status,200,path+' status');
 }
 const blocked=await fetch(base+'/auto-pool-plan');
 assert.equal(blocked.status,404,'Compensation plan must remain unpublished');
 console.log('Nisvartha web route smoke: PASS');
}finally{
 try{process.kill(-server.pid,'SIGTERM');}catch{}
}
