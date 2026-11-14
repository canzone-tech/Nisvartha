import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const argon2=require('argon2');
if(new URL(process.env.DATABASE_URL||'').pathname!=='/nisvartha_ci')
 throw Error('Versioned plan integration requires isolated CI MySQL');

const db=new PrismaClient();
const staffId=randomUUID(),password='FinancialPlan-CI-Strong-Password-2026';
const email='plan-review-'+staffId.slice(0,8)+'@example.invalid';
const port=await new Promise((resolve,reject)=>{
 const server=createServer();server.once('error',reject);
 server.listen(0,'127.0.0.1',()=>{
  const a=server.address();if(!a||typeof a==='string')return reject(Error('No port'));
  server.close(()=>resolve(a.port));
 });
});
const origin='http://127.0.0.1:'+port+'/api/v1';
const newIds=[];let child;
async function request(path,method='GET',body,token){
 const res=await fetch(origin+path,{method,headers:{
  ...(body?{'Content-Type':'application/json'}:{}),
  ...(token?{Authorization:'Bearer '+token}:{})
 },...(body?{body:JSON.stringify(body)}:{})});
 const data=await res.json().catch(()=>null);
 return {status:res.status,data};
}
try{
 const initial=await db.financialPlanState.findUniqueOrThrow({where:{id:1}});
 assert.equal(initial.currentVersionId,1,'CI needs immutable version 1 baseline');
 const hash=await argon2.hash(password,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
 await db.staffUser.create({data:{id:staffId,email,displayName:'Policy CI Administrator',
  role:'ADMIN',passwordHash:hash}});
 child=spawn(process.execPath,['backend/dist/main.js'],{
  env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port)},
  detached:true,stdio:'ignore'
 });
 let ready=false;for(let i=0;i<100;i++){
  try{if((await fetch(origin+'/health/ready')).ok){ready=true;break}}catch{}
  await new Promise(done=>setTimeout(done,120));
 }
 assert.ok(ready,'Versioned policy compiled API did not boot');
 assert.equal((await request('/cms/membership/financial-plan')).status,401);
 const login=await request('/staff/login','POST',{email,password});
 assert.equal(login.status,200);
 const token=login.data.accessToken;
 const before=await request('/cms/membership/financial-plan','GET',undefined,token);
 assert.equal(before.status,200);
 assert.equal(before.data.activeVersionId,1);
 const old=before.data.versions.find(x=>x.id===1);
 assert.equal(old.joiningAmountPaise,1_500_000);
 assert.equal(old.directReferralPaise,100_000);
 const payload={requestKey:randomUUID(),expectedVersionId:1,
  reason:'CI audited forward-effective policy revision',
  joiningAmountPaise:1_600_000,directReferralPaise:0,
  level1Paise:260_000,level2Paise:510_000,level3Paise:1_010_000,
  level4Paise:5_010_000,level5Paise:9_010_000,
  rebirthAtLevel4:2,rebirthAtLevel5:3};
 const publish=await request('/cms/membership/financial-plan/publish','POST',payload,token);
 assert.equal(publish.status,201,JSON.stringify(publish.data));
 assert.equal(publish.data.alreadyPublished,false);
 newIds.push(publish.data.id);
 assert.ok(newIds[0]>1);
 const repeated=await request('/cms/membership/financial-plan/publish','POST',payload,token);
 assert.equal(repeated.status,201,'Exact request key retry must be idempotent');
 assert.equal(repeated.data.id,publish.data.id);
 assert.equal(repeated.data.alreadyPublished,true);
 assert.equal((await request('/cms/membership/financial-plan/publish','POST',{
  ...payload,requestKey:randomUUID()
 },token)).status,409,'Stale version must be refused');
 assert.equal((await request('/cms/membership/financial-plan/publish','POST',{
  ...payload,requestKey:randomUUID(),expectedVersionId:publish.data.id,
  directReferralPaise:2_000_000
 },token)).status,400,'Retired direct commission must not be reintroduced in new plans');
 const after=await request('/cms/membership/financial-plan','GET',undefined,token);
 assert.equal(after.status,200);
 assert.equal(after.data.activeVersionId,newIds[0]);
 assert.equal(after.data.versions.find(x=>x.id===1).joiningAmountPaise,old.joiningAmountPaise,
  'Publishing altered immutable historical baseline');
 assert.equal(after.data.versions.find(x=>x.id===newIds[0]).joiningAmountPaise,1_600_000);
 assert.equal(after.data.versions.find(x=>x.id===newIds[0]).directReferralPaise,0);
 assert.equal(after.data.versions.find(x=>x.id===1).directReferralPaise,100_000,'Historical plan value remains immutable');
 const audits=await db.cmsAudit.findMany({where:{actorId:staffId,
  action:'FINANCIAL_PLAN_PUBLISHED'}});
 assert.equal(audits.length,1,'Only one successful version activation should be audited');
 console.log('Admin-only policy publish, immutable history, concurrent stale reject, invalid-money reject, idempotency and audit: PASS');
}finally{
 if(child?.pid){const done=new Promise(ok=>child.once('exit',ok));
  try{process.kill(-child.pid,'SIGTERM')}catch{}
  await Promise.race([done,new Promise(ok=>setTimeout(ok,2500))]);
 }
 await db.financialPlanState.update({where:{id:1},data:{currentVersionId:1,revision:1}});
 await db.cmsAudit.deleteMany({where:{actorId:staffId}});
 for(const id of newIds)await db.financialPlanVersion.deleteMany({where:{id}});
 await db.staffSession.deleteMany({where:{staffId}});
 await db.staffUser.deleteMany({where:{id:staffId}});
 await db.$disconnect();
}
