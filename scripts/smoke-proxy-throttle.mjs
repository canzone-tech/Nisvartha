import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';

const port=await new Promise((resolve,reject)=>{
 const s=createServer();s.once('error',reject);
 s.listen(0,'127.0.0.1',()=>{const a=s.address();s.close(()=>resolve(a.port))});
});
const base='http://127.0.0.1:'+port;
const app=spawn(process.execPath,['backend/dist/main.js'],{
 env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),
  FORM_SUBMISSIONS_ENABLED:'false',PRIVACY_NOTICE_APPROVED:'false'},
 stdio:'ignore',detached:true
});
const send=(ip)=>fetch(base+'/api/v1/enquiries/contact',{
 method:'POST',
 headers:{'Content-Type':'application/json','X-Forwarded-For':ip},
 body:'{}',
 signal:AbortSignal.timeout(6000)
});
try{
 let ready=false;
 for(let i=0;i<80;i++){
  if(app.exitCode!==null)throw Error('Compiled API failed to boot behind loopback proxy');
  try{if((await fetch(base+'/api/v1/health/ready')).ok){ready=true;break}}catch{}
  await new Promise(r=>setTimeout(r,200));
 }
 assert.ok(ready,'Compiled API readiness failed before proxy throttle smoke');
 // Distinct forwarded clients must have distinct throttle buckets.
 // App receives requests from 127.0.0.1, simulating ONLY a trusted local proxy.
 for(let n=0;n<5;n++){
  const res=await send('198.51.100.23');
  assert.equal(res.status,400,'Synthetic malformed request should fail validation before throttle');
 }
 assert.equal((await send('198.51.100.23')).status,429,
  'Same IP must be throttled after five requests');
 assert.equal((await send('203.0.113.91')).status,400,
  'Other client should not share the local proxy throttle bucket');
 assert.equal((await send('203.0.113.91')).status,400,
  'Independent second forwarded client unexpectedly throttled');
 console.log('Compiled API loopback proxy: per-client throttling with protected 429 and independent client buckets PASS');
}finally{
 if(app.pid){try{process.kill(-app.pid,'SIGTERM')}catch{}
  await Promise.race([new Promise(resolve=>app.once('exit',resolve)),
   new Promise(resolve=>setTimeout(resolve,2500))]);}
}
