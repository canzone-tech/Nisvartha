import {Body,Controller,Get,Header,Post,Req,UseGuards} from '@nestjs/common';
import {Throttle} from '@nestjs/throttler';
import {StaffRole} from '@prisma/client';
import {StaffGuard,StaffRequest,StaffRoles} from '../staff/staff.guard';
import {FinancialPlanService} from './financial-plan.service';
import {PublishFinancialPlanDto} from './financial-plan.dto';

@Controller('cms/membership/financial-plan')
@UseGuards(StaffGuard)
@StaffRoles(StaffRole.ADMIN)
export class FinancialPlanController {
 constructor(private readonly plans:FinancialPlanService){}
 @Get() @Header('Cache-Control','no-store')
 list(){return this.plans.list()}
 @Post('publish') @Throttle({default:{limit:3,ttl:60_000}})
 publish(@Body() input:PublishFinancialPlanDto,@Req() req:StaffRequest){
  return this.plans.publish(input,req.staff!);
 }
}
