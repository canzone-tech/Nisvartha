import {Body,Controller,Get,Header,HttpCode,Param,ParseUUIDPipe,Post,Query,Req,UseGuards} from '@nestjs/common';
import {Throttle} from '@nestjs/throttler';
import {StaffRole} from '@prisma/client';
import {StaffGuard,StaffRequest,StaffRoles} from '../staff/staff.guard';
import {DonationService} from './donation.service';
import {DonationRefundService} from './donation-refund.service';
import {CreateDonationRefundDto,ReconcileDonationRefundDto} from './donation-refund.dto';
import {ListDonationDto,RecordDonationDto,ReconcileDonationDto} from './donation.dto';
@Controller('staff/donations')
@UseGuards(StaffGuard)
@StaffRoles(StaffRole.ADMIN)
@Throttle({default:{limit:20,ttl:60_000}})
export class DonationController {
 constructor(private readonly service:DonationService,
  private readonly refunds:DonationRefundService){}
 @Get() @Header('Cache-Control','no-store')
 list(@Query() q:ListDonationDto,@Req() req:StaffRequest){return this.service.list(q,req.staff!)}
 @Post() @HttpCode(200) @Header('Cache-Control','no-store')
 record(@Body() body:RecordDonationDto,@Req() req:StaffRequest){return this.service.record(body,req.staff!)}
 @Post(':id/reconcile') @HttpCode(200) @Header('Cache-Control','no-store')
 reconcile(@Param('id',ParseUUIDPipe) id:string,@Body() body:ReconcileDonationDto,@Req() req:StaffRequest){
  return this.service.reconcile(id,body,req.staff!);
 }
 @Get(':id/refunds') @Header('Cache-Control','no-store')
 refundsList(@Param('id',ParseUUIDPipe) id:string,@Req() req:StaffRequest){
  return this.refunds.list(id,req.staff!);
 }
 @Post(':id/refunds') @HttpCode(200) @Header('Cache-Control','no-store')
 refundsCreate(@Param('id',ParseUUIDPipe) id:string,
  @Body() body:CreateDonationRefundDto,@Req() req:StaffRequest){
  return this.refunds.create(id,body,req.staff!);
 }
 @Post(':id/refunds/:refundId/reconcile') @HttpCode(200) @Header('Cache-Control','no-store')
 refundsReconcile(@Param('id',ParseUUIDPipe) id:string,@Param('refundId',ParseUUIDPipe) refundId:string,
  @Body() body:ReconcileDonationRefundDto,@Req() req:StaffRequest){
  return this.refunds.reconcile(id,refundId,body,req.staff!);
 }
}
