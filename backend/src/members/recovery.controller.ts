import {Body,Controller,Header,HttpCode,Param,ParseUUIDPipe,Post,Req,UseGuards} from '@nestjs/common';
import {Throttle} from '@nestjs/throttler';
import {StaffRole} from '@prisma/client';
import {StaffGuard,StaffRequest,StaffRoles} from '../staff/staff.guard';
import {IssueMemberRecoveryDto,RedeemMemberRecoveryDto} from './recovery.dto';
import {MemberRecoveryService} from './recovery.service';

@Controller('members/recovery')
export class MemberRecoveryController{
 constructor(private readonly recovery:MemberRecoveryService){}
 @Post('redeem') @HttpCode(200) @Throttle({default:{limit:5,ttl:60_000}})
 @Header('Cache-Control','no-store')
 redeem(@Body() dto:RedeemMemberRecoveryDto){return this.recovery.redeem(dto)}
}
@Controller('cms/membership/recovery')
@UseGuards(StaffGuard)
@StaffRoles(StaffRole.ADMIN)
export class MemberRecoveryAdminController{
 constructor(private readonly recovery:MemberRecoveryService){}
 @Post(':id/issue') @HttpCode(200) @Throttle({default:{limit:10,ttl:60_000}})
 @Header('Cache-Control','private, no-store')
 issue(@Param('id',ParseUUIDPipe) id:string,@Body() dto:IssueMemberRecoveryDto,@Req() req:StaffRequest){
  return this.recovery.issue(id,dto,req.staff!);
 }
}
