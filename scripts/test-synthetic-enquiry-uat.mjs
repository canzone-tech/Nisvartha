import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient,EnquiryCategory}=require('@prisma/client');
const {EnquiryService}=require('../backend/dist/enquiries/enquiry.service.js');
const url=new URL(process.env.DATABASE_URL||'mysql://invalid/no');
if(url.pathname!=='/nisvartha_ci'||!['localhost','127.0.0.1'].includes(url.hostname))
 throw Error('Synthetic enquiry test requires isolated local MySQL');
const db=new PrismaClient(),service=new EnquiryService(db),id=randomUUID();
const envKeys=['NODE_ENV','DATABASE_URL','FORM_SUBMISSIONS_ENABLED','PRIVACY_NOTICE_APPROVED','PRIVACY_NOTICE_VERSION'];
const original=Object.fromEntries(envKeys.map(x=>[x,process.env[x]]));
const body={submissionId:id,name:'Synthetic Volunteer',email:'uat-test@example.invalid',phone:'0000000000',
 subject:'Fake volunteer UAT',message:'Synthetic testing for the Foundation site only.',
 interests:'Environment',availability:'Weekends',consent:true};
try{
 delete process.env.NODE_ENV;
 process.env.PRIVACY_NOTICE_VERSION='synthetic-uat-privacy-v1';
 process.env.FORM_SUBMISSIONS_ENABLED='true';
 process.env.PRIVACY_NOTICE_APPROVED='true';
 await assert.rejects(
  ()=>service.submit(EnquiryCategory.VOLUNTEER,{...body,email:'real-person@gmail.com'}),
  error=>error.getStatus?.()===400,
  'Fake-only privacy policy accepted real email');
 const first=await service.submit(EnquiryCategory.VOLUNTEER,body);
 assert.equal(first.reference,'NF-'+id);
 const again=await service.submit(EnquiryCategory.VOLUNTEER,body);
 assert.equal(again.reference,first.reference,'Idempotent fake submit changed reference');
 await assert.rejects(
  ()=>service.submit(EnquiryCategory.VOLUNTEER,{...body,message:'Modified synthetic record'}),
  error=>error.getStatus?.()===409,'Changed retry accepted');
 const saved=await db.enquiry.findUniqueOrThrow({where:{id}});
 assert.equal(saved.category,EnquiryCategory.VOLUNTEER);
 assert.equal(saved.phone,'0000000000','Client phone must persist under consent');
 assert.equal(saved.privacyVersion,'synthetic-uat-privacy-v1');
 process.env.NODE_ENV='production';
 await assert.rejects(()=>service.submit(EnquiryCategory.VOLUNTEER,{...body,submissionId:randomUUID()}),
  error=>error.getStatus?.()===503,'Synthetic consent accepted in production');
 delete process.env.NODE_ENV;
 process.env.DATABASE_URL='mysql://live:live@127.0.0.1/nisvartha_prod';
 await assert.rejects(()=>service.submit(EnquiryCategory.VOLUNTEER,{...body,submissionId:randomUUID()}),
  error=>error.getStatus?.()===503,'Synthetic consent accepted on a live-like DB');
 console.log('Local fake-only forms: consent, authoritative MySQL, retry/replay, production & real-email rejection PASS');
}finally{
 for(const [key,value] of Object.entries(original)){
  if(value===undefined)delete process.env[key];else process.env[key]=value;
 }
 await db.enquiry.deleteMany({where:{id}});
 await db.$disconnect();
}
