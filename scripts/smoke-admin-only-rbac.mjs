import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';

const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
if(!process.env.DATABASE_URL||new URL(process.env.DATABASE_URL).pathname!=='/nisvartha_ci')
 throw Error('Admin-only RBAC smoke requires isolated nisvartha_ci');
const db=new PrismaClient();
const emailSuffix=randomUUID().slice(0,8);
const email=name=>'admin-only-'+emailSuffix+'-'+name+'@example.invalid';
const password='Synthetic-Admin-RBAC-Password-2026';
const ids=[];
const port=await new Promise((resolve,reject)=>{
 const server=createServer();server.once('error',reject);
 server.listen(0,'127.0.0.1',()=>{
  const value=server.address();
  if(!value||typeof value==='string')return reject(Error('No test port'));
  server.close(()=>resolve(value.port));
 });
});
const api='http://127.0.0.1:'+port+'/api/v1';
let child;
const request=async(path,method='GET',body,token)=>{
 const response=await fetch(api+path,{
  method,headers:{...(body?{'Content-Type':'application/json'}:{}),
   ...(token?{Authorization:'Bearer '+token}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const raw=await response.text();
 let data;try{data=JSON.parse(raw)}catch{data=raw}
 return {status:response.status,data};
};
const bootstrap=(env={})=>spawnSync(process.execPath,
 ['backend/scripts/bootstrap-admin.mjs'],{input:password+'\n',encoding:'utf8',
 env:{...process.env,NISVARTHA_BOOTSTRAP_EMAIL:email('owner'),
  NISVARTHA_BOOTSTRAP_NAME:'Synthetic Foundation Administrator',...env}});
try{
 assert.equal(await db.staffUser.count(),0,'Admin test needs empty isolated staff accounts');
 assert.notEqual(bootstrap({NISVARTHA_BOOTSTRAP_EMAIL:''}).status,0,
  'Missing bootstrap identity was accepted');
 assert.equal((await db.staffUser.count()),0);
 const first=bootstrap();
 assert.equal(first.status,0,'First ADMIN bootstrap failed: '+first.stderr?.slice(0,250));
 assert.ok(!first.stdout?.includes(password),'Password leaked to bootstrap output');
 assert.notEqual(bootstrap().status,0,'Second initial-admin bootstrap was accepted');
 const owner=await db.staffUser.findUniqueOrThrow({where:{email:email('owner')}});
 ids.push(owner.id);
 assert.equal(owner.role,'ADMIN');
 assert.equal((await db.cmsAudit.count({where:{actorId:owner.id,action:'BOOTSTRAP_ADMIN'}})),1);
 child=spawn(process.execPath,['backend/dist/main.js'],{
  env:{...process.env,PORT:String(port)},stdio:'ignore',detached:true
 });
 let ready=false;
 for(let n=0;n<90;n++){
  if(child.exitCode!==null)throw Error('Compiled NestJS crashed');
  try{if((await request('/health/ready')).status===200){ready=true;break}}catch{}
  await new Promise(resolve=>setTimeout(resolve,180));
 }
 assert.ok(ready,'Compiled API not ready');
 const login=async(name)=>{
  const res=await request('/staff/login','POST',{email:email(name),password});
  assert.equal(res.status,200,'Admin login failed');
  assert.equal(res.data.user.role,'ADMIN');
  return res.data.accessToken;
 };
 const token=await login('owner');
 assert.equal((await request('/staff/me')).status,401);
 assert.equal((await request('/staff/accounts')).status,401);
 assert.equal((await request('/staff/overview')).status,401);
 assert.equal((await request('/staff/overview','GET',undefined,token)).status,200);
 assert.equal((await request('/staff/accounts','GET',undefined,token)).status,200);
 for(const role of ['EDITOR','APPROVER','AUDITOR','SUPER_ADMIN','MEMBER']){
  assert.equal((await request('/staff/accounts','POST',{
   email:email('invalid-'+role),displayName:'Illegal role',password,role
  },token)).status,400,'Unauthorized role accepted: '+role);
 }
 const created=await request('/staff/accounts','POST',{
  email:email('second'),displayName:'Synthetic second admin',password
 },token);
 assert.equal(created.status,201,'Create ADMIN failed: '+JSON.stringify(created.data));
 ids.push(created.data.id);
 assert.equal(created.data.role,'ADMIN');
 const second=await login('second');
 assert.equal((await request('/staff/accounts/'+created.data.id,'PATCH',
  {role:'EDITOR',status:'DISABLED'},token)).status,400,
  'Legacy role update was accepted');
 assert.equal((await request('/staff/accounts/'+owner.id,'PATCH',
  {status:'DISABLED'},token)).status,403,'Self deactivation was allowed');
 const changed=await request('/staff/accounts/'+created.data.id,'PATCH',
  {status:'DISABLED'},token);
 assert.equal(changed.status,200,'Admin deactivation failed');
 assert.equal((await request('/staff/me','GET',undefined,second)).status,401,
  'Disabled admin session remained valid');
 assert.equal((await request('/staff/accounts/'+created.data.id,'PATCH',
  {status:'DISABLED'},token)).status,200,'Idempotent update failed');
 assert.equal((await db.cmsAudit.count({where:{
  actorId:owner.id,objectId:created.data.id,action:'ADMIN_STATUS'}})),1,
  'No-op status update duplicated audit');
 assert.equal((await db.staffUser.findUniqueOrThrow({where:{id:created.data.id}})).status,
  'DISABLED');
 assert.equal((await request('/staff/accounts/'+created.data.id,'PATCH',
  {status:'ACTIVE'},token)).status,200);
 assert.equal((await request('/staff/me','GET',undefined,second)).status,401,
  'Reactivated account reused revoked token');
 assert.equal((await request('/staff/me','GET',undefined,token)).status,200);
 console.log('Admin-only RBAC, first bootstrap, forbidden roles, status revocation, no-op idempotency, compiled API readiness: PASS');
}finally{
 if(child?.pid){try{process.kill(-child.pid,'SIGTERM')}catch{}
  await Promise.race([new Promise(r=>child.once('exit',r)),
   new Promise(r=>setTimeout(r,2500))]);}
 if(ids.length){
  await db.staffSession.deleteMany({where:{staffId:{in:ids}}});
  await db.cmsAudit.deleteMany({where:{actorId:{in:ids}}});
  await db.staffUser.deleteMany({where:{id:{in:ids}}});
 }
 await db.$disconnect();
}
