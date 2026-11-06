import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const {UatScenarioService}=require('../backend/dist/staff/uat-scenario.service.js');

// No MySQL connections. Test the service contract with a fixture larger than
// the displayed history page; this caught real under-counting in the UI totals.
const memberId=randomUUID();
const oldEnv=Object.fromEntries(
 ['DATABASE_URL','NODE_ENV','NISVARTHA_UAT_FINANCE','NISVARTHA_UAT_PLAN',
  'NISVARTHA_UAT_PIN_REGISTRATION'].map(key=>[key,process.env[key]])
);
Object.assign(process.env,{
 DATABASE_URL:'mysql://nisvartha_ci:testpass@127.0.0.1:33306/nisvartha_ci',
 NODE_ENV:'test',
 NISVARTHA_UAT_FINANCE:'synthetic',
 NISVARTHA_UAT_PLAN:'synthetic',
 NISVARTHA_UAT_PIN_REGISTRATION:'synthetic'
});
let aggregateCount=300,joiningCount=1;
let history=Array.from({length:201},(_,i)=>({
 id:randomUUID(),kind:'DIRECT_REFERRAL_REFERENCE',amountPaise:100000,
 createdAt:new Date(1700000000000-i*1000),sourceMemberId:randomUUID()
}));
const db={
 memberAccount:{findUnique:async ({where})=>{
  assert.equal(where.id,memberId);
  return {id:memberId,email:'synthetic@example.invalid'};
 }},
 uatScenarioEntry:{
  findMany:async ({where,take,orderBy})=>{
   assert.equal(where.beneficiaryMemberId,memberId);
   assert.equal(take,201,'Need one sentinel beyond the 200 displayed records');
   assert.deepEqual(orderBy,[{createdAt:'desc'},{id:'desc'}]);
   return history;
  },
  count:async ({where})=>{
   assert.equal(where.beneficiaryMemberId,memberId);
   assert.equal(where.kind,'JOINING_REFERENCE');
   return joiningCount;
  },
  aggregate:async ({where,_count,_sum})=>{
   assert.equal(where.beneficiaryMemberId,memberId);
   assert.equal(where.kind,'DIRECT_REFERRAL_REFERENCE');
   assert.deepEqual(_count,{_all:true});
   assert.deepEqual(_sum,{amountPaise:true});
   return {_count:{_all:aggregateCount},_sum:{amountPaise:aggregateCount*100000}};
  }
 },
 $transaction:async (queries,opts)=>{
  assert.equal(opts.isolationLevel,'RepeatableRead','Aggregates and page must share snapshot');
  return Promise.all(queries);
 }
};
try{
 const service=new UatScenarioService(db);
 const large=await service.forStaff(memberId);
 assert.equal(large.joiningRecorded,true,'Joining event may be outside paged rows');
 assert.equal(large.directReferralEvents,300);
 assert.equal(large.directReferralReferencePaise,30000000);
 assert.equal(large.entries.length,200);
 assert.equal(large.truncated,true);
 assert.equal(large.canCredit,false);
 assert.equal(large.canWithdraw,false);
 aggregateCount=0;joiningCount=0;history=[];
 const empty=await service.forStaff(memberId);
 assert.equal(empty.joiningRecorded,false);
 assert.equal(empty.directReferralEvents,0);
 assert.equal(empty.directReferralReferencePaise,0);
 assert.equal(empty.entries.length,0);
 assert.equal(empty.truncated,false);
 console.log('Local synthetic history: full authoritative totals, consistent read snapshot, correct pagination: PASS');
}finally{
 for(const [key,value] of Object.entries(oldEnv)){
  if(value===undefined)delete process.env[key];
  else process.env[key]=value;
 }
}
