import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
const id='15e5649d-6df2-46d8-8740-a34f3a91f714';
const input={submissionId:id,name:'Synthetic CI',email:'ci@example.invalid',subject:'Test enquiry',message:'Synthetic enquiry payload for isolated CI testing.',consent:true,website:''};
const port=await new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const a=s.address();if(!a||typeof a==='string')return reject(new Error('Bad port'));s.close(()=>resolve(a.port));});});
const base='http://127.0.0.1:'+port+'/api/v1';
async function exercise(enabled){
 const app=spawn(process.execPath,['backend/dist/main.js'],{env:{...process.env,PORT:String(port),MEMBER_PUBLIC_REGISTRATION_ENABLED:'false',FORM_SUBMISSIONS_ENABLED:String(enabled),PRIVACY_NOTICE_APPROVED:String(enabled),PRIVACY_NOTICE_VERSION:enabled?'CI-TEST':''},stdio:'ignore',detached:true});
 try{
  let ready=false;
  for(let i=0;i<60;i++){if(app.exitCode!==null)throw new Error('API crashed');try{const r=await fetch(base+'/health/ready');if(r.ok){assert.match(r.headers.get('x-request-id')||'',/^[0-9a-f-]{36}$/);ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
  assert.ok(ready,'Compiled API not ready');
  const denied=await fetch(base+'/members/register',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  assert.equal(denied.status,404,'Closed public member registration must reject malformed POST before DTO validation');
  const post=async data=>fetch(base+'/enquiries/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  if(!enabled){assert.equal((await post(input)).status,503);return;}
  assert.equal((await post({...input,email:'not-an-email'})).status,400);
  assert.equal((await post({...input,website:'bot.example'})).status,400);
  const first=await post(input);assert.equal(first.status,201);const original=await first.json();
  const replay=await post(input);assert.equal(replay.status,201);assert.deepEqual(await replay.json(),original);
  assert.equal((await post({...input,subject:'Changed payload'})).status,409);
  assert.equal(await db.enquiry.count({where:{id}}),1,'Replay inserted duplicate');
  console.log('Nisvartha compiled API and idempotent form smoke: PASS');
 }finally{if(app.pid){try{process.kill(-app.pid,'SIGTERM');}catch{}await Promise.race([new Promise(resolve=>app.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,2000))]);}}
}
try{await exercise(false);await exercise(true);}finally{await db.enquiry.deleteMany({where:{id}});await db.$disconnect();}
