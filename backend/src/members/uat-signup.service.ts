import {BadRequestException,ConflictException,Injectable} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import {PrismaService} from '../database/prisma.service';
import {StaffPrincipal} from '../staff/staff.dto';
import {generateOpaqueCredential} from '../security/opaque-credential';
import {validateEpinBatchRequest} from '../security/epin-batch';
import {assertUatPinEnvironment,uatPinHash} from './uat-signup-policy';
import {UatSignupPinBatchDto} from './member.dto';

@Injectable()
export class UatSignupService{
 constructor(private readonly db:PrismaService){}
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
