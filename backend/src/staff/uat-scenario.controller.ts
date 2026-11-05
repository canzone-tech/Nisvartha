import {Body,Controller,Get,Header,HttpCode,Param,ParseUUIDPipe,Post,Req,UseGuards} from '@nestjs/common';
import {Throttle} from '@nestjs/throttler';
import {StaffRole} from '@prisma/client';
import {StaffGuard,StaffRequest,StaffRoles} from './staff.guard';
import {UatScenarioService} from './uat-scenario.service';
import {RecordUatScenarioDto} from './uat-scenario.dto';
@Controller('cms/membership/uat-scenario')
@UseGuards(StaffGuard)
@StaffRoles(StaffRole.ADMIN)
@Throttle({default:{limit:10,ttl:60_000}})
export class UatScenarioAdminController{
 constructor(private readonly scenario:UatScenarioService){}
 @Get(':memberId') @Header('Cache-Control','no-store')
 get(@Param('memberId',ParseUUIDPipe) memberId:string){
  return this.scenario.forStaff(memberId);
 }
 @Post(':memberId/record') @HttpCode(200) @Header('Cache-Control','no-store')
 record(@Param('memberId',ParseUUIDPipe) memberId:string,
  @Body() body:RecordUatScenarioDto,@Req() req:StaffRequest){
  return this.scenario.record(memberId,body.requestKey,req.staff!);
 }
}
