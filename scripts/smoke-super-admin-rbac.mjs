import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';

const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const argon2=require('argon2');
if(!process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).pathname!=='/nisvartha_ci')
 throw Error('SUPER_ADMIN RBAC smoke requires isolated nisvartha_ci DB');
const db=new PrismaClient(),seed=randomUUID().slice(0,8);
const prefix='staff-rbac-'+seed;
const email=name=>prefix+'-'+name+'@example.invalid';
const password='CI-RBAC-Strong-Synthetic-Password-2026';
const port=await new Promise((resolve,reject)=>{
 const server=createServer();server.once('error',reject);
 server.listen(0,'127.0.0.1',()=>{
  const addr=server.address();
  if(!addr||typeof addr==='string')return reject(Error('Port allocation failed'));
  server.close(()=>resolve(addr.port));
 });
});
const api='http://127.0.0.1:'+port+'/api/v1';
let child;
const trackedIds=[];
async function request(path,method='GET',body,token){
 const response=await fetch(api+path,{
  method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const raw=await response.text();
 let data;try{data=JSON.parse(raw)}catch{data=raw}
 return {status:response.status,data};
}
const bootstrap=({confirm='CREATE_FIRST_STAFF_SUPER_ADMIN',approval='CI-SECURITY-APPROVAL-2026'}={})=>
 spawnSync(process.execPath,['backend/scripts/bootstrap-super-admin.mjs'],{
  input:password+'\n',encoding:'utf8',env:{
   ...process.env,
   NISVARTHA_BOOTSTRAP_EMAIL:email('root'),
   NISVARTHA_BOOTSTRAP_NAME:'CI Root Super Admin',
   NISVARTHA_SUPER_ADMIN_BOOTSTRAP_CONFIRM:confirm,
   NISVARTHA_SUPER_ADMIN_SECURITY_APPROVAL_REF:approval
  }
 });
try{
 // All credentials, names and approvals here are synthetic, never production.
 // Root bootstrap on a real isolated database must be explicit, once-only and fail closed.
 assert.equal((await db.staffUser.count()),0,'RBAC UAT requires empty isolated staff table');
 const missingApproval=bootstrap({approval:''});
 assert.notEqual(missingApproval.status,0,'Missing security approval unexpectedly bootstrapped root');
 const missingConfirmation=bootstrap({confirm:''});
 assert.notEqual(missingConfirmation.status,0,'Missing explicit confirmation unexpectedly bootstrapped root');
 assert.equal(await db.staffUser.count(),0);
 const first=bootstrap();
 assert.equal(first.status,0,'Verified first SUPER_ADMIN bootstrap failed: '+first.stderr?.slice(0,350));
 assert.ok(!first.stdout?.includes(password),'Bootstrap leaked password in stdout');
 const root=await db.staffUser.findUniqueOrThrow({where:{email:email('root')}});
 trackedIds.push(root.id);
 assert.equal(root.role,'SUPER_ADMIN');
 assert.equal(root.status,'ACTIVE');
 assert.equal(bootstrap().status===0,false,'Second bootstrap must never provision or elevate staff');
 assert.equal(await db.staffUser.count(),1);
 const rootAudit=await db.cmsAudit.findMany({where:{actorId:root.id,action:'BOOTSTRAP_SUPER_ADMIN'}});
 assert.equal(rootAudit.length,1);
 assert.ok(rootAudit[0].summary.includes('CI-SECURITY-APPROVAL-2026'));
 assert.ok(!rootAudit[0].summary.includes(password));
 const hash=await argon2.hash(password,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
 const ids=[randomUUID(),randomUUID(),randomUUID()];
 trackedIds.push(...ids);
 await db.staffUser.createMany({data:[
  {id:ids[0],email:email('admin'),displayName:'CI Ordinary Admin',role:'ADMIN',passwordHash:hash},
  {id:ids[1],email:email('editor'),displayName:'CI Editor',role:'EDITOR',passwordHash:hash},
  {id:ids[2],email:email('target'),displayName:'CI Target Admin',role:'ADMIN',passwordHash:hash},
 ]});
 child=spawn(process.execPath,['backend/dist/main.js'],{
  env:{...process.env,PORT:String(port)},stdio:'ignore',detached:true
 });
 let ready=false;
 for(let n=0;n<90;n++){
  if(child.exitCode!==null)throw Error('Compiled backend exited before readiness');
  try{if((await request('/health/ready')).status===200){ready=true;break}}catch{}
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 assert.ok(ready,'Compiled backend readiness timeout');
 const login=async name=>{
  const response=await request('/staff/login','POST',{email:email(name),password});
  assert.equal(response.status,200,'Staff login failed for '+name);
  return response.data.accessToken;
 };
 const [rootToken,adminToken,editorToken,targetToken]=await Promise.all([
  login('root'),login('admin'),login('editor'),login('target')
 ]);
 assert.equal((await request('/staff/me','GET',undefined,rootToken)).data.role,'SUPER_ADMIN');
 assert.equal((await request('/staff/accounts')).status,401,'Anonymous staff list not denied');
 assert.equal((await request('/staff/accounts','GET',undefined,editorToken)).status,403,'Editor must not manage staff');
 assert.equal((await request('/staff/accounts','GET',undefined,adminToken)).status,200,'Existing ADMIN role lost access');
 assert.equal((await request('/staff/accounts','GET',undefined,rootToken)).status,200,'SUPER_ADMIN cannot access ADMIN endpoint');
 assert.equal((await request('/cms/audit','GET',undefined,rootToken)).status,200,'SUPER_ADMIN cannot access existing ADMIN audit endpoint');

 const batchPath='/staff/epin-batches/validate';
 const expiresAt=new Date(Date.now()+48*60*60*1000).toISOString();
 const draft={quantity:2,pinType:'ACTIVATION',expiresAt};
 assert.equal((await request(batchPath,'POST',draft)).status,401,'Anonymous E-PIN preview must be blocked');
 assert.equal((await request(batchPath,'POST',draft,editorToken)).status,403,'EDITOR cannot preview restricted E-PIN policy');
 const adminPreview=await request(batchPath,'POST',draft,adminToken);
 assert.equal(adminPreview.status,200,'ADMIN must validate E-PIN batch policy');
 assert.deepEqual(adminPreview.data,{quantity:2,pinType:'ACTIVATION',expiresAt,
  issuanceStatus:'HOLD',canIssue:false,generated:0},'Preview must never return a secret or payable PIN');
 const rootPreview=await request(batchPath,'POST',{quantity:1,pinType:'INSTALLMENT',expiresAt},rootToken);
 assert.equal(rootPreview.status,200,'SUPER_ADMIN must validate installment batch');
 assert.equal(rootPreview.data.pinType,'INSTALLMENT');
 assert.equal(rootPreview.data.generated,0);
 assert.equal((await request(batchPath,'POST',{...draft,quantity:501},adminToken)).status,400,'Batch above 500 accepted');
 assert.equal((await request(batchPath,'POST',{...draft,pinType:null},rootToken)).status,400,'Explicit null kind accepted');
 assert.equal((await request(batchPath,'POST',{...draft,expiresAt:'2027-01-01T00:00:00'},adminToken)).status,400,'Timezone-less expiry accepted');
 assert.equal((await request(batchPath,'POST',{...draft,pinType:'ACTIVATION',unknown:'reject'},rootToken)).status,400,'Unknown input accepted');
 const previews=await db.cmsAudit.findMany({where:{
  actorId:{in:[root.id,ids[0]]},action:'EPIN_BATCH_POLICY_VALIDATED'
 }});
 assert.equal(previews.length,2,'Every authorized preview must be audited once; invalid attempts must not create issuance audit');
 assert.ok(previews.every(x=>!JSON.stringify(x).includes('codeHash')&&!JSON.stringify(x).includes('accessToken')));
 assert.equal(await db.cmsAudit.count({where:{action:'EPIN_BATCH_ISSUED'}}),0,'Policy preview must never issue a batch');
 console.log('E-PIN validation-only API: ADMIN/SUPER_ADMIN RBAC, strict input, no secrets/issuance, audited MySQL: PASS');

 const createPayload={email:email('forbidden'),displayName:'Forbidden Root',password,role:'SUPER_ADMIN'};
 assert.equal((await request('/staff/accounts','POST',createPayload,adminToken)).status,403,'ADMIN can issue SUPER_ADMIN role');
 assert.equal((await request('/staff/accounts','POST',createPayload,rootToken)).status,403,'In-app bootstrap bypass by SUPER_ADMIN');
 const targetRole={role:'SUPER_ADMIN',status:'ACTIVE'};
 const concurrent=await Promise.all([
  request('/staff/accounts/'+ids[2],'PATCH',targetRole,adminToken),
  request('/staff/accounts/'+ids[2],'PATCH',targetRole,rootToken)
 ]);
 assert.deepEqual(concurrent.map(x=>x.status).sort(),[403,403],'Concurrent elevated role grant allowed');
 assert.equal((await request('/staff/accounts/'+root.id,'PATCH',{role:'ADMIN',status:'DISABLED'},adminToken)).status,403,'ADMIN demoted protected SUPER_ADMIN');
 assert.equal((await request('/staff/accounts/'+root.id,'PATCH',{role:'ADMIN',status:'DISABLED'},rootToken)).status,403,'SUPER_ADMIN self-demotion allowed');
 assert.equal((await request('/staff/accounts/'+ids[0],'PATCH',{role:'EDITOR',status:'ACTIVE'},adminToken)).status,403,'Ordinary ADMIN can self-edit');
 assert.equal((await db.staffUser.findUniqueOrThrow({where:{id:root.id}})).role,'SUPER_ADMIN');
 assert.equal((await db.staffUser.findUniqueOrThrow({where:{id:ids[2]}})).role,'ADMIN');
 assert.equal(await db.staffUser.count({where:{role:'SUPER_ADMIN'}}),1,'Accidental privilege grant persisted');
 assert.equal(await db.staffUser.count({where:{email:email('forbidden')}}),0,'Denied create persisted');
 const normalCreate=await request('/staff/accounts','POST',{
  email:email('new-editor'),displayName:'CI Scoped Editor',password,role:'EDITOR'
 },rootToken);
 assert.equal(normalCreate.status,201,'SUPER_ADMIN cannot create ordinary staff');
 trackedIds.push(normalCreate.data.id);
 assert.equal(normalCreate.data.role,'EDITOR');
 const updated=await request('/staff/accounts/'+ids[2],'PATCH',{role:'EDITOR',status:'ACTIVE'},rootToken);
 assert.equal(updated.status,200,'SUPER_ADMIN cannot make legitimate scoped staff update');
 assert.equal((await request('/staff/me','GET',undefined,targetToken)).status,401,'Role change must revoke prior target sessions');
 const audited=await db.cmsAudit.findMany({where:{actorId:root.id,objectId:ids[2],action:'STAFF_ROLE_STATUS'}});
 assert.equal(audited.length,1,'Authorized scoped role change must be audited exactly once');
 assert.equal((await db.staffUser.findUniqueOrThrow({where:{id:ids[2]}})).role,'EDITOR');
 assert.equal((await request('/staff/me','GET',undefined,rootToken)).status,200,'SUPER_ADMIN session incorrectly revoked');
 console.log('SUPER_ADMIN first-account bootstrap, privilege boundary, concurrent denial, staff RBAC, audit, revocation: PASS');
}finally{
 if(child?.pid){
  const exited=new Promise(resolve=>child.once('exit',resolve));
  try{process.kill(-child.pid,'SIGTERM')}catch{}
  await Promise.race([exited,new Promise(resolve=>setTimeout(resolve,2500))]);
 }
 if(trackedIds.length){
  await db.staffSession.deleteMany({where:{staffId:{in:trackedIds}}});
  await db.cmsAudit.deleteMany({where:{actorId:{in:trackedIds}}});
  await db.staffUser.deleteMany({where:{id:{in:trackedIds}}});
 }
 await db.$disconnect();
}
