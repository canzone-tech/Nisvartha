import {BadRequestException,Body,Controller,Header,HttpCode,Post,Req,UseGuards} from '@nestjs/common';
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
@StaffRoles(StaffRole.ADMIN,StaffRole.SUPER_ADMIN)
@Throttle({default:{limit:10,ttl:60_000}})
export class StaffBatchValidationController{
 constructor(private readonly db:PrismaService){}

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
