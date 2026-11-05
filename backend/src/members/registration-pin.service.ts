import {BadRequestException,ConflictException,Injectable} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {sealRegistrationCode,unsealRegistrationCode} from '../security/pin-vault';
import {PrismaService} from '../database/prisma.service';
import {StaffPrincipal} from '../staff/staff.dto';
import {generateOpaqueCredential} from '../security/opaque-credential';
import {validateEpinBatchRequest} from '../security/epin-batch';
import {RegistrationPinBatchDto,RegistrationPinListDto} from './member.dto';
import {assertRegistrationPinEnvironment,registrationPinHash} from './registration-pin-policy';

@Injectable()
export class RegistrationPinService{
 constructor(private readonly db:PrismaService){}

 /** Admin-only re-display of encrypted registration codes; each plaintext read is audited. */
 async list(input:RegistrationPinListDto,actor:StaffPrincipal){
  assertRegistrationPinEnvironment();
  const now=new Date();
  const status=input.status??'ALL';
  const where:Prisma.RegistrationPinWhereInput=
   status==='USED'?{redeemedAt:{not:null}}:
   status==='EXPIRED'?{redeemedAt:null,expiresAt:{lte:now}}:
   status==='AVAILABLE'?{redeemedAt:null,expiresAt:{gt:now}}:{};
  if(input.cursor){
   const found=await this.db.registrationPin.findFirst({where:{id:input.cursor,...where},select:{id:true}});
   if(!found)throw new BadRequestException('Invalid registration PIN cursor');
  }
  const [rows,total,available,used,expired]=await Promise.all([
   this.db.registrationPin.findMany({
    where,orderBy:[{createdAt:'desc'},{id:'desc'}],take:51,
    ...(input.cursor?{cursor:{id:input.cursor},skip:1}:{}),
    select:{id:true,batchId:true,displaySuffix:true,sealedCode:true,expiresAt:true,redeemedAt:true,
     redeemedByMemberId:true,createdAt:true,batch:{select:{quantity:true,createdAt:true}}}
   }),
   this.db.registrationPin.count(),
   this.db.registrationPin.count({where:{redeemedAt:null,expiresAt:{gt:now}}}),
   this.db.registrationPin.count({where:{redeemedAt:{not:null}}}),
   this.db.registrationPin.count({where:{redeemedAt:null,expiresAt:{lte:now}}})
  ]);
  const page=rows.slice(0,50);
  // Decrypt first; an invalid/missing key must never be recorded as a successful reveal.
  const items=page.map(pin=>({
    id:pin.id,batchId:pin.batchId,displaySuffix:pin.displaySuffix,
    code:pin.sealedCode?unsealRegistrationCode('registration-access',pin.id,pin.sealedCode):null,
    expiresAt:pin.expiresAt,createdAt:pin.createdAt,
    redeemedAt:pin.redeemedAt,redeemedByMemberId:pin.redeemedByMemberId,
    batchQuantity:pin.batch.quantity,batchCreatedAt:pin.batch.createdAt,
    status:pin.redeemedAt?'USED':pin.expiresAt<=now?'EXPIRED':'AVAILABLE'
   });
  const displayed=items.filter(pin=>pin.code!==null).length;
  // Never return credentials if the audit write fails.
  if(displayed)await this.db.cmsAudit.create({data:{
   id:randomUUID(),actorId:actor.id,action:'REGISTRATION_PINS_VIEWED',
   objectType:'REGISTRATION_PIN_INVENTORY',objectId:actor.id,
   summary:'Admin retrieved '+displayed+' encrypted registration codes'
  }});
  return {classification:'NONFINANCIAL_REGISTRATION_ACCESS' as const,
   total,counts:{available,used,expired},status,
   items),nextCursor:rows.length>50?page[page.length-1].id:null};
 }

 async create(input:RegistrationPinBatchDto,actor:StaffPrincipal){
  assertRegistrationPinEnvironment();
  let validated:{quantity:number;expiresAt:string};
  try{validated=validateEpinBatchRequest({quantity:input.quantity,expiresAt:input.expiresAt});}
  catch(err){
   if(err instanceof RangeError||err instanceof TypeError)
    throw new BadRequestException('Invalid registration PIN quantity or expiry');
   throw err;
  }
  if(validated.quantity>50)throw new BadRequestException('Batch maximum is 50');
  if(await this.db.registrationPinBatch.findUnique({
   where:{requestKey:input.requestKey},select:{id:true}
  }))throw new ConflictException('Batch already processed; codes can only be shown once');
  const batchId=randomUUID();
  const codes=Array.from({length:validated.quantity},()=>generateOpaqueCredential());
  const rows=codes.map(code=>{
   const id=randomUUID();
   return {id,batchId,tokenHash:registrationPinHash(code),
    displaySuffix:code.slice(-6),sealedCode:sealRegistrationCode('registration-access',id,code),
    expiresAt:new Date(validated.expiresAt)};
  });
  try{
   await this.db.$transaction(async tx=>{
    await tx.registrationPinBatch.create({data:{id:batchId,requestKey:input.requestKey,
     issuerId:actor.id,quantity:validated.quantity,expiresAt:new Date(validated.expiresAt)}});
    await tx.registrationPin.createMany({data:rows});
    await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,
     action:'REGISTRATION_ACCESS_PINS_CREATED',objectType:'REGISTRATION_PIN_BATCH',
     objectId:batchId,summary:'No-fee application access codes: quantity '+validated.quantity}});
   });
  }catch(err){
   if((err as {code?:string}).code==='P2002')
    throw new ConflictException('Batch request already processed');
   throw err;
  }
  return {batchId,quantity:codes.length,expiresAt:validated.expiresAt,
   classification:'NONFINANCIAL_REGISTRATION_ACCESS',codes};
 }
}
