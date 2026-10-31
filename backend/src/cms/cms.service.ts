import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {CmsKind,CmsReviewStatus,EventLifecycle} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {PrismaService} from '../database/prisma.service';
import {StaffPrincipal} from '../staff/staff.dto';
import {ContentRevisionDto,CreateContentDto} from './cms.dto';
const blocked=new Set(['auto-pool-plan','membership','donate','register','login']);
@Injectable()
export class CmsService{
 constructor(private readonly db:PrismaService){}
 private eventFields(kind:CmsKind,input:ContentRevisionDto){
  const fields=[input.eventStartAt,input.eventEndAt,input.eventTimezone,input.eventVenue,input.eventOnlineUrl,input.eventRegistrationUrl,input.eventLifecycle];
  if(kind!==CmsKind.EVENT){
   if(fields.some(value=>value!==undefined))throw new BadRequestException('Event schedule fields are only accepted for EVENT content');
   return {};
  }
  if(!input.eventStartAt || !input.eventTimezone || (!input.eventVenue?.trim()&&!input.eventOnlineUrl)){
   throw new BadRequestException('Event start, IANA timezone and venue or HTTPS meeting URL are required');
  }
  try{new Intl.DateTimeFormat('en',{timeZone:input.eventTimezone}).format(new Date(0));}
  catch{throw new BadRequestException('Invalid IANA event timezone');}
  const parseDate=(value:string)=>{
   if(!/(Z|[+-]\\d{2}:\\d{2})$/.test(value))throw new BadRequestException('Event times require an explicit UTC offset');
   const time=new Date(value);
   if(!Number.isFinite(time.getTime()))throw new BadRequestException('Invalid event time');
   return time;
  };
  const start=parseDate(input.eventStartAt);
  const end=input.eventEndAt?parseDate(input.eventEndAt):null;
  if(end&&end<=start)throw new BadRequestException('Event end must follow start');
  return {
   eventStartAt:start,eventEndAt:end,eventTimezone:input.eventTimezone,
   eventVenue:input.eventVenue?.trim()||null,
   eventOnlineUrl:input.eventOnlineUrl||null,
   eventRegistrationUrl:input.eventRegistrationUrl||null,
   eventLifecycle:input.eventLifecycle||EventLifecycle.SCHEDULED
  };
 }
 async create(input:CreateContentDto,actor:StaffPrincipal){
  if(blocked.has(input.slug))throw new ForbiddenException('Reserved programme route requires separate legal review');
  const eventFields=this.eventFields(input.kind,input);
  try{return await this.db.$transaction(async tx=>{
   const contentId=randomUUID(),revisionId=randomUUID();
   const content=await tx.cmsContent.create({data:{id:contentId,slug:input.slug,kind:input.kind}});
   const revision=await tx.cmsRevision.create({data:{id:revisionId,contentId,version:1,title:input.title.trim(),summary:input.summary.trim(),body:input.body.trim(),authorId:actor.id,...eventFields}});
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,action:'CONTENT_CREATE',objectType:'CONTENT',objectId:content.id,summary:'Draft version 1 created'}});
   return {content,revision};
  })}catch(error){if((error as {code?:string}).code==='P2002')throw new ConflictException('Content slug already exists');throw error}
 }
 async draft(id:string,input:ContentRevisionDto,actor:StaffPrincipal){
  return this.db.$transaction(async tx=>{
   const lock=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM cms_content WHERE id=${id} FOR UPDATE`;
   if(!lock.length)throw new NotFoundException('Content not found');
   const content=await tx.cmsContent.findUniqueOrThrow({where:{id}});
   if(content.archivedAt)throw new ConflictException('Content is archived');
   const latest=await tx.cmsRevision.findFirst({where:{contentId:id},orderBy:{version:'desc'}});
   if(latest?.status===CmsReviewStatus.SUBMITTED)throw new ConflictException('Review already in progress');
   const eventFields=this.eventFields(content.kind,input);
   const next=(latest?.version||0)+1;
   const revision=await tx.cmsRevision.create({data:{id:randomUUID(),contentId:id,version:next,title:input.title.trim(),summary:input.summary.trim(),body:input.body.trim(),authorId:actor.id,...eventFields}});
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,action:'REVISION_DRAFT',objectType:'CONTENT',objectId:id,summary:'Draft version '+next+' created'}});
   return revision;
  });
 }
 async submit(id:string,actor:StaffPrincipal){
  return this.db.$transaction(async tx=>{
   const row=await tx.cmsRevision.findUnique({where:{id}});
   if(!row)throw new NotFoundException('Revision not found');
   const latest=await tx.cmsRevision.findFirst({where:{contentId:row.contentId},orderBy:{version:'desc'}});
   if(latest?.id!==id)throw new ConflictException('Only latest draft can be submitted');
   const changed=await tx.cmsRevision.updateMany({where:{id,status:{in:[CmsReviewStatus.DRAFT,CmsReviewStatus.REJECTED]}},data:{status:CmsReviewStatus.SUBMITTED,reviewerId:null,reviewReason:null}});
   if(changed.count!==1)throw new ConflictException('Revision cannot be submitted');
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,action:'REVISION_SUBMIT',objectType:'REVISION',objectId:id,summary:'Submitted version '+row.version}});
   return {id,status:CmsReviewStatus.SUBMITTED};
  });
 }
 async approve(id:string,actor:StaffPrincipal){
  return this.db.$transaction(async tx=>{
   const row=await tx.cmsRevision.findUnique({where:{id}});
   if(!row)throw new NotFoundException('Revision not found');
   if(row.authorId===actor.id)throw new ForbiddenException('Author cannot approve their own content');
   const changed=await tx.cmsRevision.updateMany({where:{id,status:CmsReviewStatus.SUBMITTED},data:{status:CmsReviewStatus.APPROVED,reviewerId:actor.id,publishedAt:new Date()}});
   if(changed.count!==1)throw new ConflictException('Revision is not submitted');
   await tx.cmsContent.update({where:{id:row.contentId},data:{publishedRevisionId:id,archivedAt:null}});
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,action:'CONTENT_PUBLISH',objectType:'CONTENT',objectId:row.contentId,summary:'Published revision '+row.version}});
   return {id,status:CmsReviewStatus.APPROVED};
  });
 }
 async reject(id:string,reason:string,actor:StaffPrincipal){
  return this.db.$transaction(async tx=>{
   const row=await tx.cmsRevision.findUnique({where:{id}});
   if(!row)throw new NotFoundException('Revision not found');
   if(row.authorId===actor.id)throw new ForbiddenException('Author cannot review own draft');
   const changed=await tx.cmsRevision.updateMany({where:{id,status:CmsReviewStatus.SUBMITTED},data:{status:CmsReviewStatus.REJECTED,reviewerId:actor.id,reviewReason:reason.trim()}});
   if(changed.count!==1)throw new ConflictException('Revision not submitted');
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,action:'REVISION_REJECT',objectType:'REVISION',objectId:id,summary:'Rejected version '+row.version+' (reason recorded in revision)'}});
   return {id,status:CmsReviewStatus.REJECTED};
  });
 }
 async archive(id:string,actor:StaffPrincipal){
  return this.db.$transaction(async tx=>{
   const updated=await tx.cmsContent.updateMany({where:{id,archivedAt:null},data:{archivedAt:new Date()}});
   if(updated.count!==1)throw new ConflictException('Not found or already archived');
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,action:'CONTENT_ARCHIVE',objectType:'CONTENT',objectId:id,summary:'Unpublished and archived'}});
   return {id,archived:true};
  });
 }
 async list(){return this.db.cmsContent.findMany({include:{revisions:{select:{id:true,version:true,status:true,authorId:true,reviewerId:true,createdAt:true},orderBy:{version:'desc'},take:3}},orderBy:{updatedAt:'desc'},take:100})}
 async detail(id:string){const content=await this.db.cmsContent.findUnique({where:{id},include:{revisions:{orderBy:{version:'desc'}}}});if(!content)throw new NotFoundException();return content}
 async publishedList(kind?:CmsKind){
  const items=await this.db.cmsContent.findMany({
   where:{archivedAt:null,publishedRevisionId:{not:null},...(kind?{kind}:{})},
   orderBy:{updatedAt:'desc'},take:100,
  });
  const ids=items.map(x=>x.publishedRevisionId).filter((x):x is string=>Boolean(x));
  const revisions=await this.db.cmsRevision.findMany({where:{id:{in:ids},status:CmsReviewStatus.APPROVED}});
  const byId=new Map(revisions.map(x=>[x.id,x]));
  return items.flatMap(item=>{
   const rev=item.publishedRevisionId?byId.get(item.publishedRevisionId):undefined;
   return rev&&rev.contentId===item.id?[{
    slug:item.slug,kind:item.kind,title:rev.title,summary:rev.summary,publishedAt:rev.publishedAt,
    ...(item.kind===CmsKind.EVENT?{eventStartAt:rev.eventStartAt,eventEndAt:rev.eventEndAt,eventTimezone:rev.eventTimezone,eventVenue:rev.eventVenue,eventOnlineUrl:rev.eventOnlineUrl,eventRegistrationUrl:rev.eventRegistrationUrl,eventLifecycle:rev.eventLifecycle}:{})
   }]:[];
  });
 }
 async published(slug:string){
  const content=await this.db.cmsContent.findUnique({where:{slug}});
  if(!content||content.archivedAt||!content.publishedRevisionId)throw new NotFoundException();
  const revision=await this.db.cmsRevision.findUnique({where:{id:content.publishedRevisionId}});
  if(!revision||revision.contentId!==content.id||revision.status!==CmsReviewStatus.APPROVED)throw new NotFoundException();
  return {slug,kind:content.kind,title:revision.title,summary:revision.summary,body:revision.body,publishedAt:revision.publishedAt,
   ...(content.kind===CmsKind.EVENT?{eventStartAt:revision.eventStartAt,eventEndAt:revision.eventEndAt,eventTimezone:revision.eventTimezone,eventVenue:revision.eventVenue,eventOnlineUrl:revision.eventOnlineUrl,eventRegistrationUrl:revision.eventRegistrationUrl,eventLifecycle:revision.eventLifecycle}:{})};
 }
 async audit(){return this.db.cmsAudit.findMany({select:{id:true,actorId:true,action:true,objectType:true,objectId:true,summary:true,createdAt:true},orderBy:{createdAt:'desc'},take:100})}
 async dashboard(){
  const [drafts,submitted,published,enquiries,volunteers]=await Promise.all([
   this.db.cmsRevision.count({where:{status:CmsReviewStatus.DRAFT}}),
   this.db.cmsRevision.count({where:{status:CmsReviewStatus.SUBMITTED}}),
   this.db.cmsContent.count({where:{archivedAt:null,publishedRevisionId:{not:null}}}),
   this.db.enquiry.count({where:{status:'NEW'}}),
   this.db.enquiry.count({where:{category:'VOLUNTEER',status:'NEW'}}),
  ]);
  return {drafts,submitted,published,newEnquiries:enquiries,newVolunteerEnquiries:volunteers};
 }
}
