if(!process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).pathname!=='/nisvartha_ci'){console.error('Refusing destructive case test outside isolated nisvartha_ci');process.exit(2)}
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const {EnquiryCaseService}=require('../backend/dist/enquiries/case.service.js');
const db=new PrismaClient(),service=new EnquiryCaseService(db);
const staffId=randomUUID(),caseId=randomUUID(),reference='NF-'+caseId;
const actor={id:staffId,role:'ADMIN',email:'case-admin@example.invalid'};
const originals={ENQUIRY_RETENTION_DAYS:process.env.ENQUIRY_RETENTION_DAYS,ENQUIRY_RETENTION_APPROVED:process.env.ENQUIRY_RETENTION_APPROVED};
try{
 await db.staffUser.create({data:{id:staffId,email:'case-'+staffId.slice(0,8)+'@example.invalid',displayName:'Synthetic Case Admin',passwordHash:'ci-only-not-for-login',role:'ADMIN'}});
 await db.enquiry.create({data:{id:caseId,reference,category:'VOLUNTEER',name:'Volunteer Synthetic',email:'volunteer@example.invalid',subject:'Volunteer review',message:'Test volunteer record for the real MySQL case workflow.',interests:'Environment',availability:'Weekends',consentAt:new Date(),privacyVersion:'CI-TEST',createdAt:new Date(Date.now()-45*86_400_000)}});
 const assigned=await service.assign(caseId,staffId,actor);
 assert.equal(assigned.assignedToId,staffId);
 await service.status(caseId,'CONTACTED',actor);
 await assert.rejects(()=>service.status(caseId,'CLOSED',actor),e=>e.getStatus?.()===400,'Invalid volunteer state accepted');
 await service.note(caseId,'Synthetic private follow-up note',actor);
 let row=await service.detail(caseId,actor);
 assert.equal(row.notes.length,1);assert.equal(row.status,'CONTACTED');
 await service.legalHold(caseId,true,'Synthetic compliance preservation',actor);
 process.env.ENQUIRY_RETENTION_DAYS='30';process.env.ENQUIRY_RETENTION_APPROVED='true';
 let result=await service.applyRetention(actor);
 assert.equal(result.anonymized,0,'Legal hold did not protect enquiry');
 await service.legalHold(caseId,false,'Approved synthetic test release',actor);
 result=await service.applyRetention(actor);
 assert.equal(result.anonymized,1,'Eligible record not anonymized');
 row=await db.enquiry.findUniqueOrThrow({where:{id:caseId}});
 assert.equal(row.name,'[redacted]');assert.equal(row.message,'[redacted]');
 assert.ok(row.anonymizedAt&&row.archivedAt);
 assert.equal(await db.enquiryNote.count({where:{enquiryId:caseId}}),0,'Internal notes were not deleted during retention');
 result=await service.applyRetention(actor);
 assert.equal(result.anonymized,0,'Retention workflow not idempotent');
 const actions=await db.cmsAudit.findMany({where:{objectType:'ENQUIRY',objectId:caseId}});
 assert.ok(actions.some(x=>x.action==='ENQUIRY_ANONYMIZE'));
 console.log('Nisvartha enquiry status, assignment, legal hold, notes, retention and idempotency: PASS');
}finally{
 for(const [key,value] of Object.entries(originals)){if(value===undefined)delete process.env[key];else process.env[key]=value}
 await db.enquiryNote.deleteMany({where:{enquiryId:caseId}});
 await db.cmsAudit.deleteMany({where:{actorId:staffId}});
 await db.enquiry.deleteMany({where:{id:caseId}});
 await db.staffSession.deleteMany({where:{staffId}});
 await db.staffUser.deleteMany({where:{id:staffId}});
 await db.$disconnect();
}
