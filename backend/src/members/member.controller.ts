import {Body,Controller,Get,Header,Headers,HttpCode,Param,ParseUUIDPipe,Patch,Post,Query,Req,UseGuards} from '@nestjs/common';
import {Throttle} from '@nestjs/throttler';
import {StaffRole} from '@prisma/client';
import {StaffGuard,StaffRequest,StaffRoles} from '../staff/staff.guard';
import {AdminMemberIdentityDto,ApplicationDecisionDto,EarningSettlementDto,MemberPayoutRequestDto,MemberPayoutPageDto,MemberReceiptPageDto,MemberPayoutProfileDto,MemberPayoutDecisionDto,MemberLoginDto,MemberPasswordDto,MemberProfileDto,MemberRegisterDto,MembershipReviewPageDto,StaffAssistedMemberRegisterDto,UatSignupPinBatchDto,UatSignupPinListDto,RegistrationPinBatchDto,RegistrationPinCancelDto,RegistrationPinListDto,RegistrationPinRefundDto,RegistrationPinReplaceDto,VerifiedPaidPinBatchDto,VerifiedOfflineSaleDto} from './member.dto';
import {MemberGuard,MemberRequest,PublicRegistrationGuard} from './member.guard';
import {MemberService} from './member.service';
import {UatSignupService} from './uat-signup.service';
import {RegistrationPinService} from './registration-pin.service';
import {UatScenarioService} from '../staff/uat-scenario.service';
import {GenealogyService} from './genealogy.service';
import {MatrixPlacementService} from './matrix-placement.service';
import {MemberCompensationService} from './member-compensation.service';
import {MemberWalletService} from './member-wallet.service';
@Controller('members')
@Throttle({default:{limit:30,ttl:60_000}})
export class MemberController{
 constructor(private readonly members:MemberService,private readonly genealogy:GenealogyService,private readonly scenario:UatScenarioService,private readonly matrix:MatrixPlacementService,private readonly compensation:MemberCompensationService,private readonly wallet:MemberWalletService){}
 @UseGuards(PublicRegistrationGuard) @Post('register') @Throttle({default:{limit:5,ttl:60_000}})
 register(@Body() input:MemberRegisterDto){return this.members.register(input)}
 @Post('login') @HttpCode(200) @Throttle({default:{limit:5,ttl:60_000}})
 login(@Body() input:MemberLoginDto){return this.members.login(input)}
 @UseGuards(MemberGuard) @Get('genealogy')
 genealogyForMember(@Req() req:MemberRequest){return this.genealogy.forMember(req.member!)}
 @UseGuards(MemberGuard) @Get('matrix') @Header('Cache-Control','no-store')
 matrixForMember(@Req() req:MemberRequest){return this.matrix.forMember(req.member!)}
 @UseGuards(MemberGuard) @Get('earnings') @Header('Cache-Control','no-store')
 earningsForMember(@Req() req:MemberRequest){return this.compensation.forMember(req.member!.id)}
 @UseGuards(MemberGuard) @Get('receipts') @Header('Cache-Control','no-store')
 receipts(@Req() req:MemberRequest,@Query() query:MemberReceiptPageDto){
  return this.members.memberReceipts(req.member!,query);
 }
 @UseGuards(MemberGuard) @Get('wallet') @Header('Cache-Control','no-store')
 walletForMember(@Req() req:MemberRequest){return this.wallet.forMember(req.member!)}
 @UseGuards(MemberGuard) @Get('wallet/payment-profile') @Header('Cache-Control','no-store')
 getPaymentProfile(@Req() req:MemberRequest){return this.wallet.paymentProfile(req.member!)}
 @UseGuards(MemberGuard) @Patch('wallet/payment-profile') @Throttle({default:{limit:8,ttl:60_000}})
 savePaymentProfile(@Req() req:MemberRequest,@Body() input:MemberPayoutProfileDto){
  return this.wallet.savePaymentProfile(req.member!,input);
 }
 @UseGuards(MemberGuard) @Get('wallet/payouts/page') @Header('Cache-Control','no-store')
 pageMemberPayouts(@Req() req:MemberRequest,@Query() input:MemberPayoutPageDto){
  return this.wallet.pageForMember(req.member!,input);
 }
 @UseGuards(MemberGuard) @Post('wallet/payouts') @Throttle({default:{limit:5,ttl:60_000}})
 requestPayout(@Req() req:MemberRequest,@Body() input:MemberPayoutRequestDto){return this.wallet.request(req.member!,input)}
 @UseGuards(MemberGuard) @Get('uat-scenario') @Header('Cache-Control','no-store')
 scenarioForMember(@Req() req:MemberRequest){return this.scenario.forMember(req.member!)}
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
@StaffRoles(StaffRole.ADMIN)
@Throttle({default:{limit:60,ttl:60_000}})
export class MembershipReviewController{
 constructor(private readonly members:MemberService,private readonly uat:UatSignupService,private readonly accessPins:RegistrationPinService,private readonly genealogy:GenealogyService,private readonly matrix:MatrixPlacementService,private readonly compensation:MemberCompensationService,private readonly wallet:MemberWalletService){}
 @Get('registration-pins/paid-summary') @StaffRoles(StaffRole.ADMIN)
 @Header('Cache-Control','no-store')
 paidPinSummary(){return this.accessPins.paidSummary()}
 @Post('registration-pins/verified-paid') @StaffRoles(StaffRole.ADMIN)
 @Throttle({default:{limit:8,ttl:60_000}})
 issueVerifiedPaidPins(@Body() input:VerifiedPaidPinBatchDto,@Req() req:StaffRequest){
  return this.accessPins.createVerifiedPaid(input,req.staff!);
 }
 @Get('registration-pins') @StaffRoles(StaffRole.ADMIN) @Header('Cache-Control','no-store')
 listRegistrationPins(@Query() query:RegistrationPinListDto,@Req() req:StaffRequest){return this.accessPins.list(query,req.staff!)}
 @Post('registration-pins') @Throttle({default:{limit:8,ttl:60_000}})
 @StaffRoles(StaffRole.ADMIN)
 createRegistrationPins(@Body() input:RegistrationPinBatchDto,@Req() req:StaffRequest){
  return this.accessPins.create(input,req.staff!);
 }
 @Post('registration-pins/:pinId/cancel') @StaffRoles(StaffRole.ADMIN)
 @Throttle({default:{limit:8,ttl:60_000}}) @HttpCode(200)
 cancelRegistrationPin(@Param('pinId',ParseUUIDPipe) pinId:string,
  @Body() input:RegistrationPinCancelDto,@Req() req:StaffRequest){
  return this.accessPins.cancel(pinId,input,req.staff!);
 }
 @Post('registration-pins/:pinId/replace') @StaffRoles(StaffRole.ADMIN)
 @Throttle({default:{limit:8,ttl:60_000}}) @HttpCode(200)
 replaceRegistrationPin(@Param('pinId',ParseUUIDPipe) pinId:string,
  @Body() input:RegistrationPinReplaceDto,@Req() req:StaffRequest){
  return this.accessPins.replace(pinId,input,req.staff!);
 }
 @Post('registration-pins/:pinId/refund') @StaffRoles(StaffRole.ADMIN)
 @Throttle({default:{limit:8,ttl:60_000}}) @HttpCode(200)
 recordPinRefund(@Param('pinId',ParseUUIDPipe) pinId:string,
  @Body() input:RegistrationPinRefundDto,@Req() req:StaffRequest){
  return this.accessPins.confirmRefund(pinId,input,req.staff!);
 }
 @Get('uat-pins') @StaffRoles(StaffRole.ADMIN) @Header('Cache-Control','no-store')
 listUatPins(@Query() query:UatSignupPinListDto,@Req() req:StaffRequest){return this.uat.listPins(query,req.staff!)}
 @Post('uat-pins') @Throttle({default:{limit:8,ttl:60_000}})
 @StaffRoles(StaffRole.ADMIN)
 issueUatPins(@Body() input:UatSignupPinBatchDto,@Req() req:StaffRequest){
  return this.uat.createBatch(input,req.staff!);
 }
 @Post('applications/register') @Throttle({default:{limit:5,ttl:60_000}})
 @StaffRoles(StaffRole.ADMIN)
 registerAssisted(@Body() input:StaffAssistedMemberRegisterDto,@Req() req:StaffRequest){
  return this.members.registerAssisted(input,req.staff!);
 }
 @Get('root/status') @StaffRoles(StaffRole.ADMIN) @Header('Cache-Control','no-store')
 rootStatus(){return this.members.rootRegistrationStatus()}
 @Post('root') @Throttle({default:{limit:3,ttl:60_000}})
 @StaffRoles(StaffRole.ADMIN)
 createRoot(@Body() input:StaffAssistedMemberRegisterDto,@Req() req:StaffRequest){
  return this.members.registerRoot(input,req.staff!);
 }
 @Patch('members/:memberId/identity') @StaffRoles(StaffRole.ADMIN)
 @Throttle({default:{limit:8,ttl:60_000}})
 correctIdentity(@Param('memberId',ParseUUIDPipe) memberId:string,
  @Body() input:AdminMemberIdentityDto,@Req() req:StaffRequest){
  return this.members.correctIdentity(memberId,input,req.staff!);
 }
 @Get('genealogy/:memberId') @StaffRoles(StaffRole.ADMIN)
 genealogyForStaff(@Param('memberId',ParseUUIDPipe) memberId:string){return this.genealogy.forStaff(memberId)}
 @Get('matrix/:memberId') @StaffRoles(StaffRole.ADMIN) @Header('Cache-Control','no-store')
 matrixForStaff(@Param('memberId',ParseUUIDPipe) memberId:string){return this.matrix.forStaff(memberId)}
 @Post('members/:memberId/sale') @StaffRoles(StaffRole.ADMIN) @HttpCode(200)
 @Throttle({default:{limit:8,ttl:60_000}})
 recordVerifiedSale(@Param('memberId',ParseUUIDPipe) memberId:string,
  @Body() input:VerifiedOfflineSaleDto,@Req() req:StaffRequest){
  return this.compensation.confirmActiveMemberSale(memberId,input,req.staff!);
 }
 @Get('earnings/:memberId') @StaffRoles(StaffRole.ADMIN) @Header('Cache-Control','no-store')
 earningsForStaff(@Param('memberId',ParseUUIDPipe) memberId:string){return this.compensation.forStaff(memberId)}
 @Post('earnings/:earningId/settle') @StaffRoles(StaffRole.ADMIN) @HttpCode(200)
 settleEarning(@Param('earningId',ParseUUIDPipe) earningId:string,@Body() input:EarningSettlementDto,@Req() req:StaffRequest){
  return this.compensation.settle(earningId,input,req.staff!);
 }
 @Get('payouts') @StaffRoles(StaffRole.ADMIN) @Header('Cache-Control','no-store')
 listPayouts(){return this.wallet.forStaff()}
 @Get('payouts/page') @StaffRoles(StaffRole.ADMIN) @Header('Cache-Control','no-store')
 pagePayouts(@Query() query:MemberPayoutPageDto){return this.wallet.pageForStaff(query)}
 @Get('payouts/:id/payment-details') @StaffRoles(StaffRole.ADMIN)
 @Throttle({default:{limit:10,ttl:60_000}}) @Header('Cache-Control','no-store')
 payoutDetails(@Param('id',ParseUUIDPipe) id:string,@Req() req:StaffRequest){
  return this.wallet.payoutDestinationForStaff(id,req.staff!);
 }
 @Post('payouts/:id/decide') @StaffRoles(StaffRole.ADMIN) @HttpCode(200)
 decidePayout(@Param('id',ParseUUIDPipe) id:string,@Body() input:MemberPayoutDecisionDto,@Req() req:StaffRequest){
  return this.wallet.decide(id,input,req.staff!);
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
