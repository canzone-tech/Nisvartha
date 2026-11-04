import {Body,Controller,Get,Headers,HttpCode,Param,ParseUUIDPipe,Patch,Post,Query,Req,UseGuards} from '@nestjs/common';
import {Throttle} from '@nestjs/throttler';
import {StaffRole} from '@prisma/client';
import {StaffGuard,StaffRequest,StaffRoles} from '../staff/staff.guard';
import {ApplicationDecisionDto,MemberLoginDto,MemberPasswordDto,MemberProfileDto,MemberRegisterDto,MembershipReviewPageDto,StaffAssistedMemberRegisterDto,UatSignupPinBatchDto} from './member.dto';
import {MemberGuard,MemberRequest} from './member.guard';
import {MemberService} from './member.service';
import {UatSignupService} from './uat-signup.service';
@Controller('members')
@Throttle({default:{limit:30,ttl:60_000}})
export class MemberController{
 constructor(private readonly members:MemberService){}
 @Post('register') @Throttle({default:{limit:5,ttl:60_000}})
 register(@Body() input:MemberRegisterDto){return this.members.register(input)}
 @Post('login') @HttpCode(200) @Throttle({default:{limit:5,ttl:60_000}})
 login(@Body() input:MemberLoginDto){return this.members.login(input)}
 @UseGuards(MemberGuard) @Get('me')
 me(@Req() req:MemberRequest){return this.members.me(req.member!)}
 @UseGuards(MemberGuard) @Patch('profile')
 profile(@Req() req:MemberRequest,@Body() input:MemberProfileDto){return this.members.updateProfile(req.member!,input)}
 @UseGuards(MemberGuard) @Post('password') @HttpCode(200)
 password(@Req() req:MemberRequest,@Body() input:MemberPasswordDto){return this.members.changePassword(req.member!,input)}
 @UseGuards(MemberGuard) @Post('logout') @HttpCode(200)
 logout(@Req() req:MemberRequest,@Headers('authorization') header:string){return this.members.logout(req.member!,header)}
 @UseGuards(MemberGuard) @Post('application/withdraw') @HttpCode(200)
 withdraw(@Req() req:MemberRequest){return this.members.withdraw(req.member!)}
}
@Controller('cms/membership')
@UseGuards(StaffGuard)
@StaffRoles(StaffRole.ADMIN,StaffRole.APPROVER)
@Throttle({default:{limit:60,ttl:60_000}})
export class MembershipReviewController{
 constructor(private readonly members:MemberService,private readonly uat:UatSignupService){}
 @Post('uat-pins') @Throttle({default:{limit:8,ttl:60_000}})
 @StaffRoles(StaffRole.ADMIN,StaffRole.SUPER_ADMIN)
 issueUatPins(@Body() input:UatSignupPinBatchDto,@Req() req:StaffRequest){
  return this.uat.createBatch(input,req.staff!);
 }
 @Post('applications/register') @Throttle({default:{limit:5,ttl:60_000}})
 @StaffRoles(StaffRole.ADMIN,StaffRole.SUPER_ADMIN)
 registerAssisted(@Body() input:StaffAssistedMemberRegisterDto,@Req() req:StaffRequest){
  return this.members.registerAssisted(input,req.staff!);
 }
 @Get('applications') list(){return this.members.listApplications()}
 @Get('applications/page')
 page(@Query() query:MembershipReviewPageDto){return this.members.listApplicationsPage(query)}

 @Get('applications/:id/history')
 history(@Param('id',ParseUUIDPipe) id:string){return this.members.applicationHistory(id)}
 @Post('applications/:id/review') @HttpCode(200)
 review(@Param('id',ParseUUIDPipe) id:string,@Req() req:StaffRequest){return this.members.markReview(id,req.staff!)}
 @Post('applications/:id/decide') @HttpCode(200)
 decide(@Param('id',ParseUUIDPipe) id:string,@Body() input:ApplicationDecisionDto,@Req() req:StaffRequest){
  return this.members.decide(id,input,req.staff!);
 }
}
