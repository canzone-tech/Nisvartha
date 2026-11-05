import {BadRequestException,Body,Controller,Get,Header,HttpCode,Param,ParseIntPipe,Post,Req,ServiceUnavailableException,UseGuards} from '@nestjs/common';
import {Throttle} from '@nestjs/throttler';
import {StaffRole} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {PrismaService} from '../database/prisma.service';
import {isDisposableUatDatabase} from '../security/disposable-uat';
import {FLYER_MATRIX_REFERENCE,simulateMatrixPlacement} from '../security/matrix-simulation';
import {StaffGuard,StaffRequest,StaffRoles} from './staff.guard';
import {MatrixPreviewDto} from './matrix-preview.dto';
import {SandboxPolicyService} from './sandbox-policy.service';
import {SaveScenarioDto,ReviewScenarioDto} from './sandbox-policy.dto';

/** No real member IDs, pin codes, balances, payout or matrix DB mutations. */
@Controller('staff/matrix-preview')
@UseGuards(StaffGuard)
@Throttle({default:{limit:8,ttl:60_000}})
export class MatrixPreviewController{
 constructor(private readonly db:PrismaService,private readonly policies:SandboxPolicyService){}
 private requireSandbox(){
  if(process.env.NISVARTHA_UAT_PLAN!=='synthetic'||!isDisposableUatDatabase())
   throw new ServiceUnavailableException('Matrix policy modelling is only available in disposable local UAT');
 }
 @StaffRoles(StaffRole.ADMIN,StaffRole.SUPER_ADMIN)
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
 @StaffRoles(StaffRole.ADMIN,StaffRole.SUPER_ADMIN)
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
 @StaffRoles(StaffRole.ADMIN,StaffRole.SUPER_ADMIN,StaffRole.APPROVER)
 @Get('policies') @Header('Cache-Control','private, no-store')
 policiesList(@Req() req:StaffRequest){
  this.requireSandbox();
  return this.policies.list(req.staff!);
 }

 @StaffRoles(StaffRole.ADMIN,StaffRole.SUPER_ADMIN)
 @Post('policies') @Header('Cache-Control','no-store')
 savePolicy(@Body() dto:SaveScenarioDto,@Req() req:StaffRequest){
  this.requireSandbox();return this.policies.save(dto,req.staff!);
 }

 @StaffRoles(StaffRole.ADMIN,StaffRole.SUPER_ADMIN)
 @Post('policies/:id/submit') @Header('Cache-Control','no-store')
 submitPolicy(@Param('id',ParseIntPipe) id:number,@Req() req:StaffRequest){
  this.requireSandbox();return this.policies.submit(id,req.staff!);
 }

 @StaffRoles(StaffRole.APPROVER,StaffRole.SUPER_ADMIN)
 @Post('policies/:id/review') @Header('Cache-Control','no-store')
 reviewPolicy(@Param('id',ParseIntPipe) id:number,@Body() dto:ReviewScenarioDto,
  @Req() req:StaffRequest){
  this.requireSandbox();return this.policies.review(id,dto,req.staff!);
 }

}
