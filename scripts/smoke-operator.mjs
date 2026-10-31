import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient,EnquiryCategory}=require('@prisma/client');
const db=new PrismaClient();
const id='7da13792-63d3-49c1-a1ad-1ce6a03b1809';
const reference='NF-'+id;
const email='operator-smoke@example.invalid';
const env={...process.env,NODE_ENV:'test',NISVARTHA_OPERATOR_DATABASE_URL:process.env.DATABASE_URL};
const script='backend/scripts/enquiries.mjs';
try{
 await db.enquiry.create({data:{
  id,reference,category:EnquiryCategory.CONTACT,
  name:'Operator Test',email,subject:'Synthetic operator test',
  message:'Synthetic isolated test enquiry for operator CLI verification.',
  consentAt:new Date(),privacyVersion:'CI-TEST'
 }});
 const list=execFileSync(process.execPath,[script,'list'],{env,encoding:'utf8'});
 assert.ok(list.includes(reference),'Reference missing from list');
 assert.ok(!list.includes(email),'List must not expose personal data');
 assert.ok(!list.includes('Operator Test'),'List must not expose names');
 const blocked=spawnSync(process.execPath,[script,'show',reference],{env,encoding:'utf8'});
 assert.equal(blocked.status,2,'Details need explicit --reveal');
 assert.ok(!blocked.stdout.includes(email),'Blocked request leaked personal data');
 const detail=execFileSync(process.execPath,[script,'show',reference,'--reveal'],{env,encoding:'utf8'});
 assert.ok(detail.includes(email),'Explicit operator detail missing');
 const missing=spawnSync(process.execPath,[script,'show','NF-00000000-0000-0000-0000-000000000000','--reveal'],{env,encoding:'utf8'});
 assert.equal(missing.status,1);
 assert.ok(!missing.stderr.includes('PrismaClient'),'Database errors should not expose internals');
 const stored=await db.enquiry.findUniqueOrThrow({where:{id}});
 assert.equal(stored.status,'NEW','Read-only workflow must not mutate enquiries');
 console.log('Nisvartha operator CLI and privacy smoke: PASS');
}finally{
 await db.enquiry.deleteMany({where:{id}});
 await db.$disconnect();
}
