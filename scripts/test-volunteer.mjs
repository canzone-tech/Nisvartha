import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient,EnquiryCategory}=require('@prisma/client');
const {EnquiryService}=require('../backend/dist/enquiries/enquiry.service.js');
const db=new PrismaClient();
const service=new EnquiryService(db);
const original={FORM_SUBMISSIONS_ENABLED:process.env.FORM_SUBMISSIONS_ENABLED,PRIVACY_NOTICE_APPROVED:process.env.PRIVACY_NOTICE_APPROVED,PRIVACY_NOTICE_VERSION:process.env.PRIVACY_NOTICE_VERSION};
process.env.FORM_SUBMISSIONS_ENABLED='true';
process.env.PRIVACY_NOTICE_APPROVED='true';
process.env.PRIVACY_NOTICE_VERSION='CI-TEST';
const id=randomUUID();
const payload={submissionId:id,name:'Test Volunteer',email:'volunteer@example.invalid',subject:'Volunteer interest',message:'I would like to assist with community activities.',consent:true};
try {
 await assert.rejects(()=>service.submit(EnquiryCategory.VOLUNTEER,payload),error=>error.getStatus?.()===400,'Interests and availability must be required');
 await assert.rejects(()=>service.submit(EnquiryCategory.VOLUNTEER,{...payload,interests:'Environment'}),error=>error.getStatus?.()===400,'Availability must be required');
 const result=await service.submit(EnquiryCategory.VOLUNTEER,{...payload,interests:'Environment',availability:'Weekends'});
 assert.equal(result.reference,'NF-'+id);
 const saved=await db.enquiry.findUniqueOrThrow({where:{id}});
 assert.equal(saved.category,'VOLUNTEER');
 assert.equal(saved.interests,'Environment');assert.equal(saved.availability,'Weekends');
 console.log('Nisvartha volunteer required fields and persistence: PASS');
}finally{
 await db.enquiry.deleteMany({where:{id}});
 await db.$disconnect();
 for(const key of Object.keys(original)){if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key];}
}
