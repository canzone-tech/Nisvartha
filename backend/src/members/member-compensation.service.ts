import {BadRequestException,ConflictException,Injectable,NotFoundException,ServiceUnavailableException} from '@nestjs/common';
import {FinancialSettlementKind,MemberEarningStatus,MemberPayoutStatus,Prisma} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {PrismaService} from '../database/prisma.service';
import {StaffPrincipal} from '../staff/staff.dto';
import {ApplicationDecisionDto,EarningSettlementDto,VerifiedOfflineSaleDto} from './member.dto';
import {registrationPinEnabled} from './registration-pin-policy';
import {MatrixPlacementService} from './matrix-placement.service';

export const OFFLINE_SALE_AMOUNT_PAISE=1_500_000;
export const DIRECT_REFERRAL_AMOUNT_PAISE=100_000;

@Injectable()
export class MemberCompensationService{
 constructor(private readonly db:PrismaService,private readonly matrix:MatrixPlacementService){}
 enabled(){return process.env.MEMBER_COMPENSATION_ENABLED==='true'}
 private assertEnabled(){
  if(!this.enabled())throw new ServiceUnavailableException('Member earnings are not enabled');
  if(process.env.NODE_ENV==='production'&&process.env.MEMBER_COMPENSATION_APPROVED!=='true')
   throw new ServiceUnavailableException('Member earnings are not approved for production');
  if(!registrationPinEnabled()||process.env.NISVARTHA_UAT_PIN_REGISTRATION==='synthetic'||
    process.env.MATRIX_PLACEMENT_ENABLED!=='true')
   throw new ServiceUnavailableException('Member earnings configuration is incomplete');
 }
 async activationReplayMatches(tx:Prisma.TransactionClient,memberId:string,input:ApplicationDecisionDto){
  if(!this.enabled()||!input.transactionRequestKey||!input.transactionReference||
     !input.transactionEvidenceRef||!input.transactionReceivedAt)return false;
  const receivedAt=new Date(input.transactionReceivedAt);
  if(!Number.isFinite(receivedAt.getTime()))return false;
  const existing=await tx.memberOfflineSale.findUnique({where:{memberId}});
  return Boolean(existing&&
   existing.requestKey===input.transactionRequestKey&&
   existing.reference===input.transactionReference.trim().toUpperCase()&&
   existing.evidenceRef===input.transactionEvidenceRef.trim().toUpperCase()&&
   existing.receivedAt.getTime()===receivedAt.getTime());
 }
 async activate(tx:Prisma.TransactionClient,memberId:string,input:ApplicationDecisionDto,actor:StaffPrincipal){
  await this.recordSale(tx,memberId,input,actor);
  return this.matrix.placeApprovedMember(tx,memberId);
 }
 // A successful PIN registration already owns its matrix position. Financial
 // confirmation must never place the account again or mark membership approved.
 async confirmActiveMemberSale(memberId:string,input:VerifiedOfflineSaleDto,actor:StaffPrincipal){
  this.assertEnabled();
  if(process.env.MEMBER_PIN_AUTO_ACTIVATE_ENABLED!=='true')
   throw new ServiceUnavailableException('Post-activation sale confirmation is not enabled');
  try{
   return await this.db.$transaction(async tx=>{
    const locked=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM member_accounts WHERE id=${memberId} FOR UPDATE`;
    if(locked.length!==1)throw new NotFoundException('Member not found');
    const member=await tx.memberAccount.findUniqueOrThrow({where:{id:memberId},
     include:{application:{select:{status:true}}}});
    if(member.status!=='ACTIVE'||member.application?.status!=='APPROVED')
     throw new ConflictException('Only an active PIN-registered member can have a sale confirmed');
    const placed=await tx.matrixPosition.findUnique({where:{entryKey:'ORIGINAL:'+memberId}});
    if(!placed)throw new ConflictException('Active member is missing their matrix position');
    const already=await tx.memberOfflineSale.findUnique({where:{memberId}});
    const sale=await this.recordSale(tx,memberId,input,actor);
    if(!already){
     await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,
      action:'MEMBER_OFFLINE_SALE_CONFIRMED',objectType:'MEMBER_OFFLINE_SALE',
      objectId:sale.id,summary:'External registration sale recorded; member activation unchanged'}});
     await tx.memberAudit.create({data:{id:randomUUID(),memberId,
      action:'OFFLINE_SALE_CONFIRMED'}});
    }
    return {memberId,saleId:sale.id,reference:sale.reference,amountPaise:sale.amountPaise};
   },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
  }catch(error){
   if(['P2002','P2034'].includes((error as {code?:string}).code??''))
    throw new ConflictException('Offline sale reference or request key is already used');
   throw error;
  }
 }
 private async recordSale(tx:Prisma.TransactionClient,memberId:string,
  input:Pick<ApplicationDecisionDto,'transactionRequestKey'|'transactionReference'|'transactionEvidenceRef'|'transactionReceivedAt'>,
  actor:StaffPrincipal){
  this.assertEnabled();
  const requestKey=input.transactionRequestKey;
  const reference=input.transactionReference?.trim().toUpperCase();
  const evidenceRef=input.transactionEvidenceRef?.trim().toUpperCase();
  const receivedAt=input.transactionReceivedAt?new Date(input.transactionReceivedAt):null;
  if(!requestKey||!reference||!evidenceRef||!receivedAt||
    !Number.isFinite(receivedAt.getTime())||receivedAt.getTime()>Date.now())
   throw new BadRequestException('Valid offline ₹15,000 transaction evidence is required for approval');
  const pin=await tx.registrationPin.findUnique({where:{redeemedByMemberId:memberId},select:{id:true}});
  if(!pin)throw new ConflictException('Member has no redeemed registration E-PIN');
  const existing=await tx.memberOfflineSale.findUnique({where:{memberId}});
  if(existing){
   if(existing.requestKey!==requestKey||existing.reference!==reference||
      existing.evidenceRef!==evidenceRef||existing.receivedAt.getTime()!==receivedAt.getTime())
    throw new ConflictException('Offline transaction is already confirmed with different evidence');
  }
  const sale=existing??await tx.memberOfflineSale.create({data:{
   id:randomUUID(),memberId,registrationPinId:pin.id,
   requestKey,reference,amountPaise:OFFLINE_SALE_AMOUNT_PAISE,receivedAt,evidenceRef,confirmedById:actor.id
  }});
  const invitation=await tx.memberInvitation.findUnique({where:{inviteeId:memberId},select:{inviterId:true}});
  if(invitation){
   await tx.memberEarning.upsert({where:{earningKey:'DIRECT:'+memberId},create:{
    id:randomUUID(),earningKey:'DIRECT:'+memberId,kind:'DIRECT_REFERRAL',
    beneficiaryMemberId:invitation.inviterId,sourceMemberId:memberId,
    amountPaise:DIRECT_REFERRAL_AMOUNT_PAISE
   },update:{}});
  }
  return sale;
 }
 async forMember(memberId:string){this.assertEnabled();return this.read(memberId,false)}
 async forStaff(memberId:string){this.assertEnabled();return this.read(memberId,true)}
 private async read(memberId:string,staff:boolean){
  const [sale,earnings,earnedTotals,settledTotals]=await this.db.$transaction([
   this.db.memberOfflineSale.findUnique({where:{memberId},select:{
    reference:true,amountPaise:true,receivedAt:true,createdAt:true,
    ...(staff?{evidenceRef:true}:{})
   }}),
   this.db.memberEarning.findMany({where:{beneficiaryMemberId:memberId},
    orderBy:[{createdAt:'desc'},{id:'desc'}],take:200,
    select:{id:true,kind:true,level:true,amountPaise:true,status:true,createdAt:true,
     settlementReference:true,settlementEvidenceRef:true,settledAt:true,
     sourcePosition:{select:{sequence:true,kind:true}},
     sourceMember:{select:{displayName:true}}}}),
   this.db.memberEarning.aggregate({where:{
    beneficiaryMemberId:memberId,status:MemberEarningStatus.EARNED
   },_sum:{amountPaise:true},_count:{_all:true}}),
   this.db.memberEarning.aggregate({where:{
    beneficiaryMemberId:memberId,status:MemberEarningStatus.SETTLED
   },_sum:{amountPaise:true},_count:{_all:true}})
  ],{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  const summary={
   earnedPaise:earnedTotals._sum.amountPaise??0,
   settledPaise:settledTotals._sum.amountPaise??0,
   earnedCount:earnedTotals._count._all,
   settledCount:settledTotals._count._all
  };
  const visibleEarnings=earnings.map(row=>({
   ...row,
   settlementEvidenceRef:staff?row.settlementEvidenceRef:undefined,
   sourceMember:row.sourceMember?(staff?{displayName:row.sourceMember.displayName}:{}):null
  }));
  return {sale,earnings:visibleEarnings,summary,totalPaise:summary.earnedPaise+summary.settledPaise};
 }
 async settle(id:string,input:EarningSettlementDto,actor:StaffPrincipal){
  this.assertEnabled();
  const settledAt=new Date(input.settledAt);
  if(!Number.isFinite(settledAt.getTime())||settledAt.getTime()>Date.now())
   throw new BadRequestException('Invalid settlement time');
  const reference=input.settlementReference.trim().toUpperCase();
  const evidenceRef=input.evidenceRef.trim().toUpperCase();
  const initial=await this.db.memberEarning.findUnique({where:{id},select:{beneficiaryMemberId:true}});
  if(!initial)throw new NotFoundException('Earning not found');
  try{
   return await this.db.$transaction(async tx=>{
    // Shared lock order: member first, then earning. Payout reservations use
    // the same member row, preventing a settlement from double-spending funds.
    await tx.$queryRaw`SELECT id FROM member_accounts WHERE id=${initial.beneficiaryMemberId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM member_earnings WHERE id=${id} FOR UPDATE`;
    const earning=await tx.memberEarning.findUnique({where:{id}});
    if(!earning)throw new NotFoundException('Earning not found');
    if(earning.status===MemberEarningStatus.SETTLED){
     if(earning.settlementRequestKey===input.requestKey&&earning.settlementReference===reference&&
       earning.settlementEvidenceRef===evidenceRef&&earning.settledAt?.getTime()===settledAt.getTime())
      return earning;
     throw new ConflictException('Earning is already settled');
    }
    const payoutExists=await tx.memberPayoutRequest.count({where:{
     memberId:earning.beneficiaryMemberId,
     status:{in:[MemberPayoutStatus.REQUESTED,MemberPayoutStatus.PAID]}
    }});
    if(payoutExists)throw new ConflictException('Use wallet payout workflow; payout reservation already exists');
    await tx.financialSettlementReference.create({data:{
     reference,sourceId:id,sourceKind:FinancialSettlementKind.EARNING
    }});
    const changed=await tx.memberEarning.update({where:{id},data:{
     status:MemberEarningStatus.SETTLED,settlementRequestKey:input.requestKey,
     settlementReference:reference,settlementEvidenceRef:evidenceRef,
     settledAt,settledById:actor.id
    }});
    await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,
     action:'MEMBER_EARNING_SETTLED',objectType:'MEMBER_EARNING',objectId:id,
     summary:'Offline earning settlement recorded with external evidence'}});
    return changed;
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }catch(err){
   if((err as {code?:string}).code==='P2002')throw new ConflictException('Settlement request/reference already used');
   throw err;
  }
 }
}
