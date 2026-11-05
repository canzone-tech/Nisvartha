import {BadRequestException,Body,Controller,Get,Header,HttpCode,Post,Req,ServiceUnavailableException,UseGuards} from '@nestjs/common';
import {Throttle} from '@nestjs/throttler';
import {StaffRole} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {PrismaService} from '../database/prisma.service';
import {isDisposableUatDatabase} from '../security/disposable-uat';
import {FLYER_MATRIX_REFERENCE,simulateMatrixPlacement} from '../security/matrix-simulation';
import {StaffGuard,StaffRequest,StaffRoles} from './staff.guard';
import {MatrixPreviewDto} from './matrix-preview.dto';

/** No real member IDs, pin codes, balances, payout or matrix DB mutations. */
@Controller('staff/matrix-preview')
@UseGuards(StaffGuard)
@StaffRoles(StaffRole.ADMIN,StaffRole.SUPER_ADMIN)
@Throttle({default:{limit:8,ttl:60_000}})
export class MatrixPreviewController{
 constructor(private readonly db:PrismaService){}
 private requireSandbox(){
  if(process.env.NISVARTHA_UAT_PLAN!=='synthetic'||!isDisposableUatDatabase())
   throw new ServiceUnavailableException('Matrix policy modelling is only available in disposable local UAT');
 }
 @Get('defaults') @Header('Cache-Control','private, no-store')
 defaults(){
  this.requireSandbox();
  return {
   config:{entrants:0,rebirthAtLevel4:FLYER_MATRIX_REFERENCE.rebirthAtLevel4,
    rebirthAtLevel5:FLYER_MATRIX_REFERENCE.rebirthAtLevel5,rebirthLimit:4,
    rebirthEnabled:true},
   reference:FLYER_MATRIX_REFERENCE,status:'SIMULATION_ONLY',persisted:false
  };
 }
 @Post('simulate') @HttpCode(200) @Header('Cache-Control','no-store')
 async simulate(@Body() dto:MatrixPreviewDto,@Req() req:StaffRequest){
  this.requireSandbox();
  let preview;
  try{preview=simulateMatrixPlacement(dto);}
  catch(e){
   if(e instanceof RangeError||e instanceof TypeError)
    throw new BadRequestException(e.message);
   throw e;
  }
  await this.db.cmsAudit.create({data:{
   id:randomUUID(),actorId:req.staff!.id,
   action:'MATRIX_REBIRTH_POLICY_SIMULATED',objectType:'STAFF_PREVIEW',
   objectId:randomUUID(),
   summary:'Read-only 1:3 matrix proposal preview: '+preview.placed+
    ' fake positions, rebirth candidates '+preview.rebirthCandidates.reduce((n,e)=>n+e.count,0)+
    '. No IDs, earnings or balances posted.'
  }});
  return preview;
 }
}
