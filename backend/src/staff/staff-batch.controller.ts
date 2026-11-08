import {BadRequestException,Body,Controller,Get,Header,HttpCode,Post,Req,UseGuards} from '@nestjs/common';
import {StaffRole} from '@prisma/client';
import {Throttle} from '@nestjs/throttler';
import {randomUUID} from 'node:crypto';
import {PrismaService} from '../database/prisma.service';
import {validateEpinBatchRequest} from '../security/epin-batch';
import {StaffBatchValidationDto} from './staff-batch.dto';
import {StaffGuard,StaffRequest,StaffRoles} from './staff.guard';

/**
 * Privileged, audited policy preview only. Explicitly no code generation,
 * inventory, payment settlement, paid activation or membership state.
 * This route can never issue an E-PIN, even if called repeatedly.
 */
@Controller('staff/epin-batches')
@UseGuards(StaffGuard)
@StaffRoles(StaffRole.ADMIN)
@Throttle({default:{limit:10,ttl:60_000}})
export class StaffBatchValidationController{
 constructor(private readonly db:PrismaService){}

 /**
  * Personal, bounded audit history; no cross-operator data or secret material.
  * Uses existing immutable CMS audit rows and actor/createdAt DB index.
  */
 @Get('history') @Header('Cache-Control','private, no-store')
 history(@Req() req:StaffRequest){
  return this.db.cmsAudit.findMany({
   where:{actorId:req.staff!.id,action:'EPIN_BATCH_POLICY_VALIDATED',
    objectType:'STAFF_PREVIEW'},
   select:{id:true,action:true,summary:true,createdAt:true},
   orderBy:[{createdAt:'desc'},{id:'desc'}],
   take:25
  });
 }

 @Post('validate') @HttpCode(200) @Header('Cache-Control','no-store')
 async validate(@Body() dto:StaffBatchValidationDto,@Req() req:StaffRequest){
  let validated;
  try{validated=validateEpinBatchRequest(dto)}
  catch(err){
   if(err instanceof TypeError||err instanceof RangeError)
    throw new BadRequestException(err.message);
   throw err;
  }
  await this.db.cmsAudit.create({data:{
   id:randomUUID(),actorId:req.staff!.id,
   action:'EPIN_BATCH_POLICY_VALIDATED',objectType:'STAFF_PREVIEW',objectId:randomUUID(),
   summary:'E-PIN policy preview '+validated.pinType+
    ' quantity '+validated.quantity+' (HOLD; no PINs generated)'
  }});
  return {...validated,issuanceStatus:'HOLD' as const,canIssue:false,generated:0};
 }
}
