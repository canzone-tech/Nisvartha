import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';

const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const argon2=require('argon2');
if(!process.env.DATABASE_URL||new URL(process.env.DATABASE_URL).pathname!=='/nisvartha_ci')
 throw Error('Review pagination UAT requires isolated nisvartha_ci MySQL');
const db=new PrismaClient(),seed=randomUUID().slice(0,8);
const members=Array.from({length:127},(_,index)=>({
 id:randomUUID(),email:'page-'+seed+'-'+index+'@example.invalid',
 displayName:'Synthetic review '+index,passwordHash:'CI-no-login-placeholder',
 status:'PENDING'
}));
const sameCreatedAt=new Date('2026-10-15T10:30:30.000Z');
const applications=members.map((member,index)=>({
 id:randomUUID(),memberId:member.id,
 status:index<90?'SUBMITTED':'UNDER_REVIEW',
 termsVersion:'ci-only',privacyVersion:'ci-only',consentAt:sameCreatedAt,
 createdAt:sameCreatedAt
}));
const staffId=randomUUID(),editorId=randomUUID(),pass='CI-Review-Pagination-Password-2026';
const reviewerEmail='page-review-'+seed+'@example.invalid';
const editorEmail='page-editor-'+seed+'@example.invalid';
const port=await new Promise((resolve,reject)=>{
 const server=createServer();server.once('error',reject);
 server.listen(0,'127.0.0.1',()=>{
  const address=server.address();if(!address||typeof address==='string')return reject(Error('Invalid port'));
  server.close(()=>resolve(address.port));
 });
});
const api='http://127.0.0.1:'+port+'/api/v1';
let child;
async function request(route,token){
 const res=await fetch(api+route,{headers:token?{Authorization:'Bearer '+token}:{}});
 const raw=await res.text();
 let data;try{data=JSON.parse(raw)}catch{data=raw}
 return {status:res.status,data};
}
try{
 const hash=await argon2.hash(pass,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
 await db.staffUser.createMany({data:[
  {id:staffId,email:reviewerEmail,displayName:'Review Pagination CI',passwordHash:hash,role:'APPROVER'},
  {id:editorId,email:editorEmail,displayName:'Denied Pagination CI',passwordHash:hash,role:'EDITOR'}
 ]});
 await db.memberAccount.createMany({data:members});
 await db.membershipApplication.createMany({data:applications});
 child=spawn(process.execPath,['backend/dist/main.js'],{
  env:{...process.env,PORT:String(port)},stdio:'ignore',detached:true
 });
 let ready=false;
 for(let attempt=0;attempt<90;attempt++){
  if(child.exitCode!==null)throw Error('Compiled backend terminated before readiness');
  try{if((await fetch(api+'/health/ready')).ok){ready=true;break}}catch{}
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 assert.ok(ready,'Compiled backend readiness timeout');
 const login=async(email)=>{
  const res=await fetch(api+'/staff/login',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({email,password:pass})});
  assert.equal(res.status,200,'CI staff login failed');
  return (await res.json()).accessToken;
 };
 const reviewer=await login(reviewerEmail),editor=await login(editorEmail);
 const base='/cms/membership/applications/page';
 assert.equal((await request(base)).status,401,'Anonymous pagination access allowed');
 assert.equal((await request(base,editor)).status,403,'EDITOR must not read applications');
 assert.equal((await request(base+'?limit=0',reviewer)).status,400,'Zero limit accepted');
 assert.equal((await request(base+'?limit=51',reviewer)).status,400,'Unbounded limit accepted');
 assert.equal((await request(base+'?limit=-1',reviewer)).status,400,'Negative limit accepted');
 assert.equal((await request(base+'?limit=1e3',reviewer)).status,400,'Scientific notation accepted');
 assert.equal((await request(base+'?status=UNKNOWN',reviewer)).status,400,'Unknown status accepted');
 assert.equal((await request(base+'?cursor=not-a-uuid',reviewer)).status,400,'Invalid cursor accepted');
 assert.equal((await request(base+'?injected=bad',reviewer)).status,400,'Unknown query accepted');
 assert.equal((await request(base+'?cursor='+randomUUID(),reviewer)).status,400,'Nonexistent cursor accepted');
 const legacy=await request('/cms/membership/applications',reviewer);
 assert.equal(legacy.status,200);
 assert.equal(legacy.data.length,100,'Original review list contract changed unexpectedly');
 const all=[],unique=new Set();
 let cursor=null;
 for(let page=0;page<12;page++){
  const route=base+'?limit=25'+(cursor?'&cursor='+encodeURIComponent(cursor):'');
  const reply=await request(route,reviewer);
  assert.equal(reply.status,200,'Member review page failed: '+JSON.stringify(reply.data).slice(0,200));
  const {items,nextCursor}=reply.data;
  assert.ok(Array.isArray(items)&&items.length<=25);
  for(const item of items){
   assert.ok(!unique.has(item.id),'Duplicate review record across pages: '+item.id);
   unique.add(item.id);all.push(item);
   assert.deepEqual(Object.keys(item.member).sort(),['displayName','email','id','status']);
  }
  if(nextCursor===null)break;
  assert.equal(nextCursor,items[items.length-1].id,'Cursor must be last exposed row');
  cursor=nextCursor;
 }
 assert.equal(all.length,127,'Pagination lost applications after first 100');
 assert.deepEqual([...unique].sort(),applications.map(item=>item.id).sort(),
  'Pagination did not visit every synthetic application');
 assert.deepEqual(all.map(item=>item.id),[...all].sort((a,b)=>
  b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id)).map(item=>item.id),
  'Tie-break order must be deterministic even with identical createdAt timestamps');
 async function collect(status){
  let token=null;const out=[];
  for(let page=0;page<8;page++){
   const response=await request(base+'?limit=25&status='+status+(token?'&cursor='+token:''),reviewer);
   assert.equal(response.status,200,'Status-filtered review failed: '+status);
   assert.ok(response.data.items.every(row=>row.status===status),'Mixed statuses returned');
   out.push(...response.data.items);
   token=response.data.nextCursor;
   if(!token)return out;
  }
  throw Error('Status filter pagination did not terminate');
 }
 const submitted=await collect('SUBMITTED');
 assert.equal(submitted.length,90,'Status filter must traverse all pending applications');
 assert.equal((await collect('UNDER_REVIEW')).length,37);
 assert.equal((await collect('APPROVED')).length,0);
 const cursorWrongStatus=all.find(item=>item.status==='UNDER_REVIEW').id;
 assert.equal((await request(base+'?status=SUBMITTED&cursor='+cursorWrongStatus,reviewer)).status,400,
  'Cursor for another status must fail closed');
 assert.equal((await request(base+'?limit=1',reviewer)).data.items.length,1,'Small page limit ignored');
 assert.equal((await request(base,reviewer)).data.items.length,25,'Default page size must be 25');
 assert.equal((await db.cmsAudit.count({where:{actorId:staffId,action:'MEMBER_APPLICATION_APPROVED'}})),0,
  'Read-only review queue must not make financial or membership decisions');
 console.log('Review queue pagination: >100 rows, tied timestamps, status filters, cursor validation, RBAC and read-only: PASS');
}finally{
 if(child?.pid){
  const exited=new Promise(resolve=>child.once('exit',resolve));
  try{process.kill(-child.pid,'SIGTERM')}catch{}
  await Promise.race([exited,new Promise(resolve=>setTimeout(resolve,2500))]);
 }
 await db.membershipApplication.deleteMany({where:{id:{in:applications.map(x=>x.id)}}});
 await db.memberAccount.deleteMany({where:{id:{in:members.map(x=>x.id)}}});
 await db.cmsAudit.deleteMany({where:{actorId:{in:[staffId,editorId]}}});
 await db.staffSession.deleteMany({where:{staffId:{in:[staffId,editorId]}}});
 await db.staffUser.deleteMany({where:{id:{in:[staffId,editorId]}}});
 await db.$disconnect();
}
