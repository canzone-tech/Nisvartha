import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient,StaffRole}=require('@prisma/client');
const {SandboxPolicyService}=require('../backend/dist/staff/sandbox-policy.service.js');

const dbUrl=new URL(process.env.DATABASE_URL||'');
if(dbUrl.protocol!=='mysql:'||
 !['127.0.0.1','localhost'].includes(dbUrl.hostname)||
 dbUrl.pathname!=='/nisvartha_ci')
 throw Error('Versioned sandbox tests require isolated MySQL database');

const db=new PrismaClient(),service=new SandboxPolicyService(db);
const envKeys=['NODE_ENV','DATABASE_URL','NISVARTHA_UAT_PLAN'];
const saved=Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));
const staffIds=[],scenarioIds=[];
const principal=(id,role)=>({id,role,email:'fake-'+id.slice(0,6)+'@example.invalid'});
const actor={id:randomUUID(),role:StaffRole.ADMIN};
const wrongAuthor={id:randomUUID(),role:StaffRole.ADMIN};
const reviewer={id:randomUUID(),role:StaffRole.APPROVER};
const base={entrants:120,rebirthAtLevel4:1,rebirthAtLevel5:3,
 rebirthLimit:4,rebirthEnabled:true};

try{
 delete process.env.NODE_ENV;
 process.env.NISVARTHA_UAT_PLAN='synthetic';
 for(const p of [actor,wrongAuthor,reviewer]){
  staffIds.push(p.id);
  await db.staffUser.create({data:{id:p.id,email:'fake-'+p.id+'@example.invalid',
   displayName:'Synthetic Sandbox Test',passwordHash:'fake_hash_no_login',
   role:p.role}});
 }
 const key=randomUUID();
 const first=await service.save({...base,requestKey:key},principal(actor.id,actor.role));
 scenarioIds.push(first.id);
 assert.equal(first.status,'DRAFT');
 const replay=await service.save({...base,requestKey:key},principal(actor.id,actor.role));
 assert.equal(replay.id,first.id,'Same-key replay created duplicate revision');
 assert.equal(await db.sandboxPolicyRevision.count({where:{requestKey:key}}),1);
 await assert.rejects(()=>service.save({...base,entrants:121,requestKey:key},
  principal(actor.id,actor.role)),error=>error.getStatus?.()===409,
  'Same idempotency key with different configuration accepted');
 await assert.rejects(()=>service.save({...base,requestKey:randomUUID()},
  principal(reviewer.id,reviewer.role)),error=>error.getStatus?.()===403,
  'APPROVER saved version instead of reviewing');
 await assert.rejects(()=>service.submit(first.id,principal(wrongAuthor.id,wrongAuthor.role)),
  error=>error.getStatus?.()===403,'Someone else submitted immutable version');
 assert.equal((await service.submit(first.id,principal(actor.id,actor.role))).status,'SUBMITTED');
 await assert.rejects(()=>service.submit(first.id,principal(actor.id,actor.role)),
  error=>error.getStatus?.()===409,'Duplicate submit accepted');
 await assert.rejects(()=>service.review(first.id,{
  decision:'REVIEWED',reason:'Independent sandbox modelling review'
 },principal(actor.id,actor.role)),error=>error.getStatus?.()===403,
 'Author self-reviewed own draft');
 assert.equal((await service.review(first.id,{
  decision:'REVIEWED',reason:'Independent sandbox modelling review'
 },principal(reviewer.id,reviewer.role))).status,'REVIEWED');
 await assert.rejects(()=>service.review(first.id,{
  decision:'REJECTED',reason:'Cannot reverse a settled review'
 },principal(reviewer.id,reviewer.role)),error=>error.getStatus?.()===409,
 'Concurrent/finalized scenario could be reviewed twice');
 const retained=await db.sandboxPolicyRevision.findUniqueOrThrow({where:{id:first.id}});
 assert.equal(retained.authorId,actor.id);
 assert.equal(retained.reviewerId,reviewer.id);
 assert.equal(retained.entrants,120);
 assert.equal(retained.reason,'Independent sandbox modelling review');
 assert.ok(retained.submittedAt&&retained.reviewedAt);

 const second=await service.save({...base,entrants:363,requestKey:randomUUID()},
  principal(actor.id,actor.role));
 scenarioIds.push(second.id);
 assert.ok(second.id>first.id,'Version IDs should be monotonically allocated');
 assert.equal((await service.submit(second.id,principal(actor.id,actor.role))).status,'SUBMITTED');
 assert.equal((await service.review(second.id,{
  decision:'REJECTED',reason:'Rebirth conditions are not an approved operational rule'
 },principal(reviewer.id,reviewer.role))).status,'REJECTED');
 const versions=await service.list(principal(reviewer.id,reviewer.role));
 assert.ok(versions.length>=2);
 assert.ok(versions[0].id>=versions[1].id,'Newest versions should be listed first');
 assert.equal((await db.cmsAudit.count({
  where:{objectType:'SANDBOX_POLICY',objectId:String(first.id)}
 })),3,'Save/submit/review must each create an authoritative audit row');
 await assert.rejects(()=>service.list(principal(reviewer.id,StaffRole.EDITOR)),
  error=>error.getStatus?.()===403,'EDITOR accessed scenario history');
 process.env.NODE_ENV='production';
 await assert.rejects(()=>service.list(principal(actor.id,StaffRole.ADMIN)),
  error=>error.getStatus?.()===503,'Production accepted synthetic policies');
 delete process.env.NODE_ENV;
 process.env.DATABASE_URL='mysql://fake:fake@127.0.0.1/nisvartha_production';
 await assert.rejects(()=>service.save({...base,requestKey:randomUUID()},
  principal(actor.id,StaffRole.ADMIN)),error=>error.getStatus?.()===503,
  'Non-disposable DB accepted synthetic draft');
 process.env.DATABASE_URL=saved.DATABASE_URL;

 // Simultaneous requests with the same idempotency key must never create two
 // versions, regardless of which transaction obtains the unique index first.
 const concurrentKey=randomUUID();
 const results=await Promise.allSettled([
  service.save({...base,entrants:39,requestKey:concurrentKey},principal(actor.id,actor.role)),
  service.save({...base,entrants:39,requestKey:concurrentKey},principal(actor.id,actor.role))
 ]);
 assert.ok(results.some(x=>x.status==='fulfilled'));
 const concurrent=await db.sandboxPolicyRevision.findUniqueOrThrow({
  where:{requestKey:concurrentKey}
 });
 scenarioIds.push(concurrent.id);
 assert.equal(await db.sandboxPolicyRevision.count({where:{requestKey:concurrentKey}}),1);
 assert.equal((await db.cmsAudit.count({
  where:{objectType:'SANDBOX_POLICY',objectId:String(concurrent.id),
   action:'SANDBOX_POLICY_SAVED'}
 })),1,'Concurrent retries duplicated the audit event');
 console.log('MySQL scenario versions: immutable drafts, UUID replay, reviewer separation, state CAS, audit, concurrent duplicates and production refusal PASS');
}finally{
 for(const [key,value] of Object.entries(saved)){
  if(value===undefined)delete process.env[key];else process.env[key]=value;
 }
 if(scenarioIds.length){
  await db.cmsAudit.deleteMany({where:{objectType:'SANDBOX_POLICY',
   objectId:{in:scenarioIds.map(String)}}});
  await db.sandboxPolicyRevision.deleteMany({where:{id:{in:scenarioIds}}});
 }
 await db.staffUser.deleteMany({where:{id:{in:staffIds}}});
 await db.$disconnect();
}
