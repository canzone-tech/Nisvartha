import {BadRequestException,ConflictException,Injectable} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {PrismaService} from '../database/prisma.service';
import {StaffPrincipal} from '../staff/staff.dto';
import {generateOpaqueCredential} from '../security/opaque-credential';
import {validateEpinBatchRequest} from '../security/epin-batch';
import {assertUatPinEnvironment,uatPinHash} from './uat-signup-policy';
import {UatSignupPinBatchDto,UatSignupPinListDto} from './member.dto';

@Injectable()
export class UatSignupService{
 constructor(private readonly db:PrismaService){}

 /** Bounded metadata-only list. Plaintext E-PINs and hashes must never leave storage. */
 async listPins(input:UatSignupPinListDto){
  assertUatPinEnvironment();
  const now=new Date();
  const status=input.status??'ALL';
  const where:Prisma.UatSignupPinWhereInput=
   status==='USED'?{redeemedAt:{not:null}}:
   status==='EXPIRED'?{redeemedAt:null,expiresAt:{lte:now}}:
   status==='AVAILABLE'?{redeemedAt:null,expiresAt:{gt:now}}:{};
  if(input.cursor){
   const found=await this.db.uatSignupPin.findFirst({where:{id:input.cursor,...where},select:{id:true}});
   if(!found)throw new BadRequestException('Invalid E-PIN list cursor');
  }
  const [rows,total,available,used,expired]=await Promise.all([
   this.db.uatSignupPin.findMany({
    where,orderBy:[{createdAt:'desc'},{id:'desc'}],take:51,
    ...(input.cursor?{cursor:{id:input.cursor},skip:1}:{}),
    select:{id:true,batchId:true,displaySuffix:true,expiresAt:true,
     redeemedAt:true,redeemedByMemberId:true,createdAt:true,
     batch:{select:{quantity:true,createdAt:true,issuerId:true}}}
   }),
   this.db.uatSignupPin.count(),
   this.db.uatSignupPin.count({where:{redeemedAt:null,expiresAt:{gt:now}}}),
   this.db.uatSignupPin.count({where:{redeemedAt:{not:null}}}),
   this.db.uatSignupPin.count({where:{redeemedAt:null,expiresAt:{lte:now}}})
  ]);
  const hasMore=rows.length>50;
  const page=rows.slice(0,50);
  return {
   classification:'SYNTHETIC_NONFINANCIAL_UAT_ONLY' as const,
   total,counts:{available,used,expired},status,
   items:page.map(pin=>({
    id:pin.id,batchId:pin.batchId,displaySuffix:pin.displaySuffix,
    expiresAt:pin.expiresAt,createdAt:pin.createdAt,
    redeemedAt:pin.redeemedAt,redeemedByMemberId:pin.redeemedByMemberId,
    batchQuantity:pin.batch.quantity,batchCreatedAt:pin.batch.createdAt,
    status:pin.redeemedAt?'USED':pin.expiresAt<=now?'EXPIRED':'AVAILABLE'
   })),
   nextCursor:hasMore?page[page.length-1].id:null
  };
 }

 async createBatch(input:UatSignupPinBatchDto,actor:StaffPrincipal){
  assertUatPinEnvironment();
  let validated:{quantity:number;expiresAt:string};
  try{validated=validateEpinBatchRequest({quantity:input.quantity,expiresAt:input.expiresAt});}
  catch(error){
   if(error instanceof RangeError||error instanceof TypeError)
    throw new BadRequestException('Invalid nonfinancial UAT batch policy');
   throw error;
  }
  if(validated.quantity>50)throw new BadRequestException('UAT batches are limited to 50 codes');
  if(await this.db.uatSignupPinBatch.findUnique({where:{requestKey:input.requestKey},select:{id:true}}))
   throw new ConflictException('This request was already processed; codes are only returned once');
  const batchId=randomUUID();
  const codes=Array.from({length:validated.quantity},()=>generateOpaqueCredential());
  const records=codes.map(code=>({
   id:randomUUID(),batchId,tokenHash:uatPinHash(code),
   displaySuffix:code.slice(-6),expiresAt:new Date(validated.expiresAt)
  }));
  try{
   await this.db.$transaction(async tx=>{
    await tx.uatSignupPinBatch.create({data:{
     id:batchId,requestKey:input.requestKey,issuerId:actor.id,
     quantity:validated.quantity,expiresAt:new Date(validated.expiresAt)
    }});
    await tx.uatSignupPin.createMany({data:records});
    await tx.cmsAudit.create({data:{
     id:randomUUID(),actorId:actor.id,action:'UAT_SIGNUP_PINS_CREATED',
     objectType:'UAT_PIN_BATCH',objectId:batchId,
     summary:'Synthetic nonfinancial signup credentials for disposable UAT: quantity '+validated.quantity
    }});
   });
  }catch(error){
   if((error as {code?:string}).code==='P2002')
    throw new ConflictException('This batch request was already processed');
   throw error;
  }
  return {batchId,quantity:codes.length,expiresAt:validated.expiresAt,
   classification:'SYNTHETIC_NONFINANCIAL_UAT_ONLY',codes};
 }
}
