import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException,ServiceUnavailableException} from '@nestjs/common';
import {EnquiryCategory,EnquiryStatus,Prisma,StaffRole,StaffStatus} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {PrismaService} from '../database/prisma.service';
import {StaffPrincipal} from '../staff/staff.dto';
@Injectable()
export class EnquiryCaseService{
 constructor(private readonly db:PrismaService){}
 async list(){
  return this.db.enquiry.findMany({
   select:{id:true,reference:true,category:true,status:true,assignedToId:true,caseRevision:true,createdAt:true,archivedAt:true,legalHoldAt:true},
   orderBy:{createdAt:'desc'},take:100,
  });
 }
 async detail(id:string,actor:StaffPrincipal){
  return this.db.$transaction(async tx=>{
   const row=await tx.enquiry.findUnique({where:{id},include:{notes:{orderBy:{createdAt:'asc'}}}});
   if(!row)throw new NotFoundException('Enquiry not found');
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,action:'ENQUIRY_READ',objectType:'ENQUIRY',objectId:id,summary:'Authorized staff accessed enquiry detail'}});
   return row;
  });
 }
 private async lockCase(tx:Prisma.TransactionClient,id:string){
  const rows=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM enquiries WHERE id=${id} FOR UPDATE`;
  if(!rows.length)throw new NotFoundException('Enquiry not found');
  const row=await tx.enquiry.findUniqueOrThrow({where:{id}});
  if(row.anonymizedAt)throw new ConflictException('Enquiry has been anonymized');
  return row;
 }
 async assign(id:string,staffId:string,actor:StaffPrincipal){
  return this.db.$transaction(async tx=>{
   const row=await this.lockCase(tx,id);
   const staff=await tx.staffUser.findUnique({where:{id:staffId}});
   if(!staff||staff.status!==StaffStatus.ACTIVE||staff.role!==StaffRole.ADMIN)
    throw new BadRequestException('Assignee is not an active enquiry handler');
   const updated=await tx.enquiry.update({where:{id},data:{assignedToId:staffId,caseRevision:{increment:1}}});
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,action:'ENQUIRY_ASSIGN',objectType:'ENQUIRY',objectId:id,summary:'Assignee changed; case revision '+updated.caseRevision}});
   return {reference:row.reference,assignedToId:updated.assignedToId,caseRevision:updated.caseRevision};
  });
 }
 async status(id:string,status:EnquiryStatus,actor:StaffPrincipal){
  return this.db.$transaction(async tx=>{
   const row=await this.lockCase(tx,id);
   const allowed:EnquiryStatus[]=row.category===EnquiryCategory.CONTACT
    ?[EnquiryStatus.NEW,EnquiryStatus.IN_REVIEW,EnquiryStatus.CLOSED]
    :[EnquiryStatus.NEW,EnquiryStatus.IN_REVIEW,EnquiryStatus.CONTACTED,EnquiryStatus.ACCEPTED,EnquiryStatus.DECLINED,EnquiryStatus.WITHDRAWN];
   if(!allowed.includes(status))throw new BadRequestException('Status is not valid for this enquiry category');
   if(row.status===status)return {reference:row.reference,status,caseRevision:row.caseRevision};
   const updated=await tx.enquiry.update({where:{id},data:{status,caseRevision:{increment:1}}});
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,action:'ENQUIRY_STATUS',objectType:'ENQUIRY',objectId:id,summary:'Status '+row.status+' -> '+status}});
   return {reference:row.reference,status:updated.status,caseRevision:updated.caseRevision};
  });
 }
 async note(id:string,body:string,actor:StaffPrincipal){
  return this.db.$transaction(async tx=>{
   await this.lockCase(tx,id);
   const saved=await tx.enquiryNote.create({data:{id:randomUUID(),enquiryId:id,authorId:actor.id,body:body.trim()}});
   await tx.enquiry.update({where:{id},data:{caseRevision:{increment:1}}});
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,action:'ENQUIRY_NOTE',objectType:'ENQUIRY',objectId:id,summary:'Internal staff note added; note body excluded from audit'}});
   return {id:saved.id,createdAt:saved.createdAt};
  });
 }
 async legalHold(id:string,enabled:boolean,reason:string,actor:StaffPrincipal){
  return this.db.$transaction(async tx=>{
   await this.lockCase(tx,id);
   const saved=await tx.enquiry.update({where:{id},data:{legalHoldAt:enabled?new Date():null,caseRevision:{increment:1}}});
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,action:'ENQUIRY_LEGAL_HOLD',objectType:'ENQUIRY',objectId:id,summary:(enabled?'Applied':'Released')+' legal hold: '+reason.trim()}});
   return {reference:saved.reference,legalHoldAt:saved.legalHoldAt};
  });
 }
 async exportPage(actor:StaffPrincipal){
  return this.db.$transaction(async tx=>{
   const rows=await tx.enquiry.findMany({where:{anonymizedAt:null},orderBy:{createdAt:'desc'},take:500,
    select:{reference:true,category:true,name:true,email:true,phone:true,subject:true,status:true,assignedToId:true,createdAt:true}});
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,action:'ENQUIRY_EXPORT',objectType:'ENQUIRY',objectId:'PAGE_500',summary:'Authorized export up to 500 enquiry records; count '+rows.length}});
   return {count:rows.length,limit:500,records:rows};
  });
 }
 async applyRetention(actor:StaffPrincipal){
  const days=Number(process.env.ENQUIRY_RETENTION_DAYS);
  if(process.env.ENQUIRY_RETENTION_APPROVED!=='true'||!Number.isSafeInteger(days)||days<30||days>3650)
   throw new ServiceUnavailableException('Approved retention policy is not configured');
  const cutoff=new Date(Date.now()-days*86_400_000);
  const candidates=await this.db.enquiry.findMany({where:{createdAt:{lt:cutoff},legalHoldAt:null,anonymizedAt:null},select:{id:true},take:50});
  let changed=0;
  for(const candidate of candidates){
   const updated=await this.db.$transaction(async tx=>{
    const rows=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM enquiries WHERE id=${candidate.id} FOR UPDATE`;
    if(!rows.length)return false;
    const current=await tx.enquiry.findUniqueOrThrow({where:{id:candidate.id}});
    if(current.legalHoldAt||current.anonymizedAt||current.createdAt>=cutoff)return false;
    await tx.enquiryNote.deleteMany({where:{enquiryId:current.id}});
    await tx.enquiry.update({where:{id:current.id},data:{
     name:'[redacted]',email:'removed-'+current.id+'@invalid.local',phone:null,
     subject:'[redacted]',message:'[redacted]',interests:null,availability:null,
     anonymizedAt:new Date(),archivedAt:new Date(),assignedToId:null,caseRevision:{increment:1},
    }});
    await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,action:'ENQUIRY_ANONYMIZE',objectType:'ENQUIRY',objectId:current.id,summary:'Approved retention policy applied, personal fields and staff notes removed'}});
    return true;
   });
   if(updated)changed++;
  }
  return {anonymized:changed,limit:50,cutoff:cutoff.toISOString()};
 }
}
