import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException,ServiceUnavailableException} from '@nestjs/common';
import {MediaReviewStatus} from '@prisma/client';
import {createHash,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {constants} from 'node:fs';
import {mkdir,open,rm} from 'node:fs/promises';
import {isAbsolute,join,resolve} from 'node:path';
import {promisify} from 'node:util';
import sharp = require('sharp');
import {PrismaService} from '../database/prisma.service';
import {StaffPrincipal} from '../staff/staff.dto';
import {MediaUploadDto,MediaRejectDto} from './media.dto';

const exec=promisify(execFile);
const MAX_INPUT=5*1024*1024;
const MAX_PIXELS=16_000_000;
const allowed=new Map([['jpeg','image/jpeg'],['png','image/png'],['webp','image/webp']]);
type Upload={buffer:Buffer;size:number;originalname:string;mimetype:string};

@Injectable()
export class MediaService{
 constructor(private readonly db:PrismaService){}
 private root(){
  const value=process.env.MEDIA_STORAGE_ROOT;
  if(!value||!isAbsolute(value)||value==='/'||value.trim().length<5)
   throw new ServiceUnavailableException('Private local media directory is not configured');
  return resolve(value);
 }
 private async scan(file:string){
  const binary=process.env.MEDIA_SCANNER_BIN||'clamscan';
  if(process.env.NODE_ENV==='production'&&binary!=='clamscan')
   throw new ServiceUnavailableException('Production uploads require local ClamAV');
  try{
   const {stdout}=await exec(binary,['--no-summary','--stdout',file],{timeout:30_000,maxBuffer:64*1024});
   if(!stdout.includes('OK'))throw new Error('Media scan did not confirm clean content');
  }catch{throw new ServiceUnavailableException('Media upload scanner unavailable or file unsafe')}
 }
 async upload(file:Upload|undefined,input:MediaUploadDto,actor:StaffPrincipal){
  if(!file?.buffer || file.size<=0 || file.size>MAX_INPUT||file.buffer.length!==file.size)
   throw new BadRequestException('Invalid image (maximum 5 MB)');
  if(!input.rightsConfirmed||!input.consentConfirmed)
   throw new BadRequestException('Rights and participant consent must be confirmed');
  if(!/^[A-Za-z0-9][A-Za-z0-9_-]{7,119}$/.test(input.rightsEvidenceRef||'')||
     !/^[A-Za-z0-9][A-Za-z0-9_-]{7,119}$/.test(input.consentEvidenceRef||''))
   throw new BadRequestException('Private rights and consent evidence references are required');
  const root=this.root();
  const tmpDir=join(root,'.incoming'),objects=join(root,'objects');
  await mkdir(tmpDir,{recursive:true,mode:0o700});
  await mkdir(objects,{recursive:true,mode:0o700});
  const id=randomUUID(),temp=join(tmpDir,id+'.original'),key=id+'.webp',destination=join(objects,key);
  let saved=false;
  try{
   // Store original only briefly in private staging for local antivirus checking.
   const handle=await open(temp,'wx',0o600);
   try{await handle.writeFile(file.buffer);}finally{await handle.close();}
   await this.scan(temp);
   const metadata=await (async()=>{
    try{return await sharp(file.buffer,{failOn:'error',limitInputPixels:MAX_PIXELS}).metadata();}
    catch{throw new BadRequestException('Unable to decode image');}
   })();
   if(!metadata.format||!allowed.has(metadata.format)||metadata.width===undefined||metadata.height===undefined)
    throw new BadRequestException('Only decodable JPEG, PNG and WebP images are accepted');
   if(metadata.width<1||metadata.height<1||metadata.width*metadata.height>MAX_PIXELS)
    throw new BadRequestException('Image dimensions are not permitted');
   if(allowed.get(metadata.format)!==file.mimetype)
    throw new BadRequestException('Image MIME type does not match image bytes');
   const output=await (async()=>{
    try{
     return await sharp(file.buffer,{failOn:'error',limitInputPixels:MAX_PIXELS})
      .rotate().resize({width:1920,height:1920,fit:'inside',withoutEnlargement:true})
      .webp({quality:82,effort:4}).toBuffer({resolveWithObject:true});
    }catch{throw new BadRequestException('Unable to process image');}
   })();
   if(output.data.length>MAX_INPUT)throw new BadRequestException('Processed image exceeds size limit');
   // Never place original EXIF/GPS, arbitrary filename or source bytes in the public store.
   const handleOut=await open(destination,'wx',0o600);
   try{await handleOut.writeFile(output.data);}finally{await handleOut.close();}
   saved=true;
   const digest=createHash('sha256').update(output.data).digest('hex');
   const media=await this.db.$transaction(async tx=>{
    const record=await tx.cmsMedia.create({data:{
     id,fileKey:key,sha256:digest,mimeType:'image/webp',
     bytes:output.data.length,width:output.info.width,height:output.info.height,
     title:input.title.trim(),altText:input.altText.trim(),caption:input.caption?.trim()||null,
     rightsConfirmed:true,consentConfirmed:true,
     rightsEvidenceRef:input.rightsEvidenceRef,consentEvidenceRef:input.consentEvidenceRef,uploaderId:actor.id
    }});
    await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,action:'MEDIA_UPLOAD',objectType:'MEDIA',objectId:id,summary:'Private image staged for editorial review'}});
    return record;
   });
   return {id:media.id,status:media.status,title:media.title,width:media.width,height:media.height};
  }catch(error){
   if(saved)await rm(destination,{force:true}).catch(()=>{});
   throw error;
  }finally{await rm(temp,{force:true}).catch(()=>{});}
 }
 async listStaff(){
  return this.db.cmsMedia.findMany({select:{
   id:true,title:true,altText:true,caption:true,width:true,height:true,status:true,
   uploaderId:true,reviewerId:true,createdAt:true,reviewReason:true,
   rightsEvidenceRef:true,consentEvidenceRef:true
  },orderBy:{createdAt:'desc'},take:100});
 }
 async submit(id:string,actor:StaffPrincipal){
  return this.db.$transaction(async tx=>{
   const updated=await tx.cmsMedia.updateMany({where:{id,status:{in:[MediaReviewStatus.DRAFT,MediaReviewStatus.REJECTED]},uploaderId:actor.id},data:{status:MediaReviewStatus.SUBMITTED,reviewerId:null,reviewReason:null}});
   if(updated.count!==1)throw new ConflictException('Only the uploader may submit an eligible image');
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,action:'MEDIA_SUBMIT',objectType:'MEDIA',objectId:id,summary:'Image submitted for review'}});
   return {id,status:MediaReviewStatus.SUBMITTED};
  });
 }
 async approve(id:string,actor:StaffPrincipal){
  return this.db.$transaction(async tx=>{
   const media=await tx.cmsMedia.findUnique({where:{id}});
   if(!media)throw new NotFoundException('Image not found');
   if(media.uploaderId===actor.id)throw new ForbiddenException('Uploader cannot approve own media');
   if(!media.rightsConfirmed||!media.consentConfirmed||!media.rightsEvidenceRef||!media.consentEvidenceRef)
    throw new ForbiddenException('Media rights and consent evidence references are required');
   const updated=await tx.cmsMedia.updateMany({where:{id,status:MediaReviewStatus.SUBMITTED},data:{status:MediaReviewStatus.APPROVED,reviewerId:actor.id,reviewedAt:new Date()}});
   if(updated.count!==1)throw new ConflictException('Image not submitted for approval');
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,action:'MEDIA_PUBLISH',objectType:'MEDIA',objectId:id,summary:'Reviewed and approved image for public gallery'}});
   return {id,status:MediaReviewStatus.APPROVED};
  });
 }
 async reject(id:string,input:MediaRejectDto,actor:StaffPrincipal){
  return this.db.$transaction(async tx=>{
   const media=await tx.cmsMedia.findUnique({where:{id}});
   if(!media)throw new NotFoundException('Image not found');
   if(media.uploaderId===actor.id)throw new ForbiddenException('Uploader cannot review own media');
   const updated=await tx.cmsMedia.updateMany({where:{id,status:MediaReviewStatus.SUBMITTED},data:{status:MediaReviewStatus.REJECTED,reviewerId:actor.id,reviewReason:input.reason.trim(),reviewedAt:new Date()}});
   if(updated.count!==1)throw new ConflictException('Image not submitted for review');
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,action:'MEDIA_REJECT',objectType:'MEDIA',objectId:id,summary:'Image rejected; detailed reason stored privately'}});
   return {id,status:MediaReviewStatus.REJECTED};
  });
 }
 async archive(id:string,actor:StaffPrincipal){
  return this.db.$transaction(async tx=>{
   const updated=await tx.cmsMedia.updateMany({where:{id,status:{not:MediaReviewStatus.ARCHIVED}},data:{status:MediaReviewStatus.ARCHIVED}});
   if(updated.count!==1)throw new ConflictException('Image missing or already archived');
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,action:'MEDIA_ARCHIVE',objectType:'MEDIA',objectId:id,summary:'Image removed from public gallery'}});
   return {id,status:MediaReviewStatus.ARCHIVED};
  });
 }
 async gallery(){
  return this.db.cmsMedia.findMany({where:{status:MediaReviewStatus.APPROVED},
   select:{id:true,title:true,altText:true,caption:true,width:true,height:true,createdAt:true},
   orderBy:{createdAt:'desc'},take:100});
 }
 async approvedFile(id:string):Promise<Buffer>{
  const media=await this.db.cmsMedia.findUnique({where:{id},select:{
   status:true,fileKey:true,sha256:true,bytes:true,mimeType:true
  }});
  if(!media||media.status!==MediaReviewStatus.APPROVED)throw new NotFoundException();
  if(!/^[0-9a-f-]{36}[.]webp$/.test(media.fileKey)||media.fileKey!==id+'.webp'||
     media.mimeType!=='image/webp'||!Number.isSafeInteger(media.bytes)||
     media.bytes<1||media.bytes>MAX_INPUT||!/^[0-9a-f]{64}$/.test(media.sha256))
   throw new NotFoundException('Approved image metadata is invalid');
  const path=join(this.root(),'objects',media.fileKey);
  // Read through one NOFOLLOW file descriptor and verify the bytes *before*
  // creating the HTTP response. lstat()+createReadStream() leaves a path
  // replacement race and trusts data that may no longer match MySQL.
  try{
   const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
   try{
    const info=await handle.stat();
    if(!info.isFile()||info.size!==media.bytes)
     throw new Error('Unexpected approved image file');
    const bytes=await handle.readFile();
    if(bytes.length!==media.bytes||
       createHash('sha256').update(bytes).digest('hex')!==media.sha256)
     throw new Error('Approved image checksum mismatch');
    return bytes;
   }finally{await handle.close();}
  }catch{
   // Never deliver unverified file bytes, arbitrary filesystem errors,
   // attacker-controlled paths, or internal storage details to the visitor.
   throw new NotFoundException('Approved image is not currently available');
  }
 }
}
