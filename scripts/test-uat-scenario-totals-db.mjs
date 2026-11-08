import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';

const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient,MemberAccountStatus,StaffRole,UatScenarioEntryKind}=require('@prisma/client');
const {UatScenarioService}=require('../backend/dist/staff/uat-scenario.service.js');
const {isDisposableUatDatabase}=require('../backend/dist/security/disposable-uat.js');

// Real MySQL regression: the 200-row display page must never cap authoritative
// synthetic totals. Run only after migrations on the isolated nisvartha_ci DB.
if(!isDisposableUatDatabase())
 throw Error('Scenario totals integration test requires disposable local nisvartha_ci MySQL');

const keys=['NISVARTHA_UAT_FINANCE','NISVARTHA_UAT_PLAN',
 'NISVARTHA_UAT_PIN_REGISTRATION'];
const old=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
for(const key of keys)process.env[key]='synthetic';

const db=new PrismaClient();
const service=new UatScenarioService(db);
const seed=randomUUID().slice(0,12);
const staffId=randomUUID();
const accounts=Array.from({length:302},(_,index)=>({
 id:randomUUID(),email:'scenario-'+seed+'-'+index+'@example.invalid',
 displayName:'Synthetic scenario member '+index,
 passwordHash:'fixture-no-login',status:MemberAccountStatus.ACTIVE
}));
const beneficiary=accounts[0];
const unrelated=accounts[301];
const JOIN=UatScenarioEntryKind.JOINING_REFERENCE;
const DIRECT=UatScenarioEntryKind.DIRECT_REFERRAL_REFERENCE;
const baseTime=new Date('2026-01-02T00:00:00.000Z').getTime();
const entries=[
 {id:randomUUID(),kind:JOIN,sourceMemberId:beneficiary.id,
  beneficiaryMemberId:beneficiary.id,recordedByStaffId:staffId,
  requestKey:randomUUID(),amountPaise:1500000,
  createdAt:new Date('2026-01-01T00:00:00.000Z')},
 ...accounts.slice(1,301).map((source,index)=>({
  id:randomUUID(),kind:DIRECT,sourceMemberId:source.id,
  beneficiaryMemberId:beneficiary.id,recordedByStaffId:staffId,
  amountPaise:100000,createdAt:new Date(baseTime+index*1000)
 })),
 {id:randomUUID(),kind:DIRECT,sourceMemberId:unrelated.id,
  beneficiaryMemberId:unrelated.id,recordedByStaffId:staffId,
  amountPaise:100000,createdAt:new Date(baseTime+300000)}
];

try{
 await db.staffUser.create({data:{id:staffId,
  email:'scenario-admin-'+seed+'@example.invalid',
  displayName:'Synthetic scenario test admin',
  passwordHash:'fixture-no-login',role:StaffRole.ADMIN}});
 await db.memberAccount.createMany({data:accounts});
 await db.uatScenarioEntry.createMany({data:entries});

 const view=await service.forStaff(beneficiary.id);
 assert.equal(view.status,'LOCAL_SYNTHETIC_REFERENCE_ONLY');
 assert.equal(view.joiningRecorded,true,'Joining row outside display page was missed');
 assert.equal(view.directReferralEvents,300,'Direct totals were limited to 200 rows');
 assert.equal(view.directReferralReferencePaise,30000000);
 assert.equal(view.entries.length,200);
 assert.equal(view.truncated,true);
 assert.ok(view.entries.every(e=>e.kind===DIRECT));
 assert.equal(view.entries[0].sourceMemberId,accounts[300].id,
  'History must be newest-first');
 assert.equal(view.canAcceptPayment,false);
 assert.equal(view.canCredit,false);
 assert.equal(view.canWithdraw,false);

 const memberView=await service.forMember({
  id:beneficiary.id,status:MemberAccountStatus.ACTIVE
 });
 assert.equal(memberView.directReferralEvents,300);
 await assert.rejects(()=>service.forMember({
  id:beneficiary.id,status:MemberAccountStatus.PENDING
 }),e=>e.getStatus?.()===403,'Pending member accessed the UAT totals');

 const other=await service.forStaff(unrelated.id);
 assert.equal(other.joiningRecorded,false);
 assert.equal(other.directReferralEvents,1);
 assert.equal(other.directReferralReferencePaise,100000);
 assert.equal(other.entries.length,1);
 assert.equal(other.truncated,false,'Other members must not inherit pagination');

 const priorNodeEnv=process.env.NODE_ENV;
 try{
  process.env.NODE_ENV='production';
  await assert.rejects(()=>service.forStaff(beneficiary.id),
   e=>e.getStatus?.()===503,'Production environment accessed synthetic references');
 }finally{
  if(priorNodeEnv===undefined)delete process.env.NODE_ENV;
  else process.env.NODE_ENV=priorNodeEnv;
 }
 console.log('Real MySQL synthetic totals: 300 referrals, 200-row page, old joining, isolation, RBAC and production HOLD PASS');
}finally{
 try{
  await db.uatScenarioEntry.deleteMany({
   where:{sourceMemberId:{in:accounts.map(account=>account.id)}}});
  await db.memberAccount.deleteMany({
   where:{id:{in:accounts.map(account=>account.id)}}});
  await db.staffUser.deleteMany({where:{id:staffId}});
 }finally{
  await db.$disconnect();
  for(const [key,value] of Object.entries(old)){
   if(value===undefined)delete process.env[key];
   else process.env[key]=value;
  }
 }
}
