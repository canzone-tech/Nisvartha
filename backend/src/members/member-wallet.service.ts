import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException,ServiceUnavailableException} from '@nestjs/common';
import {FinancialSettlementKind,MemberEarningStatus,MemberPayoutStatus,Prisma} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {PrismaService} from '../database/prisma.service';
import {StaffPrincipal} from '../staff/staff.dto';
import {MemberPrincipal,MemberPayoutDecisionDto,MemberPayoutRequestDto} from './member.dto';

@Injectable()
export class MemberWalletService {
 constructor(private readonly db:PrismaService){}
 enabled(){return process.env.MEMBER_WALLET_ENABLED==='true'&&process.env.MEMBER_PORTAL_ENABLED==='true'}
 payoutsEnabled(){return this.enabled()&&process.env.MEMBER_COMPENSATION_ENABLED==='true'&&
  (process.env.NODE_ENV!=='production'||process.env.MEMBER_COMPENSATION_APPROVED==='true')}
 private checkEnabled(){
  if(!this.enabled())throw new ServiceUnavailableException('Member wallet is not available');
 }
 private checkPayoutEnabled(){
  this.checkEnabled();
  if(!this.payoutsEnabled())throw new ServiceUnavailableException('Wallet payout requests are not enabled');
 }
 private sum(value:number|null|undefined){return value??0}
 private safe(value:number){
  if(!Number.isSafeInteger(value)||value<0)
   throw new ConflictException('Wallet ledger requires reconciliation');
  return value;
 }
 private async amounts(db:Prisma.TransactionClient,memberId:string){
  const earned=await db.memberEarning.aggregate({where:{
   beneficiaryMemberId:memberId,status:MemberEarningStatus.EARNED
  },_sum:{amountPaise:true}});
  const settled=await db.memberEarning.aggregate({where:{
   beneficiaryMemberId:memberId,status:MemberEarningStatus.SETTLED
  },_sum:{amountPaise:true}});
  const reserved=await db.memberPayoutRequest.aggregate({where:{
   memberId,status:MemberPayoutStatus.REQUESTED
  },_sum:{amountPaise:true}});
  const paid=await db.memberPayoutRequest.aggregate({where:{
   memberId,status:MemberPayoutStatus.PAID
  },_sum:{amountPaise:true}});
  const earnedPaise=this.safe(this.sum(earned._sum.amountPaise));
  const settledPaise=this.safe(this.sum(settled._sum.amountPaise));
  const reservedPaise=this.safe(this.sum(reserved._sum.amountPaise));
  const payoutPaidPaise=this.safe(this.sum(paid._sum.amountPaise));
  const availablePaise=earnedPaise-reservedPaise-payoutPaidPaise;
  if(!Number.isSafeInteger(availablePaise)||availablePaise<0)
   throw new ConflictException('Wallet funds and reservations do not reconcile');
  return {earnedPaise,legacySettledPaise:settledPaise,
   reservedPaise,paidPaise:this.safe(settledPaise+payoutPaidPaise),
   availablePaise,totalEarnedPaise:this.safe(earnedPaise+settledPaise)};
 }
 async forMember(actor:MemberPrincipal){
  this.checkEnabled();
  const [wallet,payouts]=await this.db.$transaction(async tx=>{
   const amounts=await this.amounts(tx,actor.id);
   const rows=await tx.memberPayoutRequest.findMany({where:{memberId:actor.id},
    orderBy:[{createdAt:'desc'},{id:'desc'}],take:100,
    select:{id:true,amountPaise:true,status:true,createdAt:true,
     decidedAt:true,settlementReference:true,paidAt:true,rejectionReason:true}});
   return [amounts,rows] as const;
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  return {wallet,payouts,canRequest:actor.status==='ACTIVE'&&this.payoutsEnabled()};
 }
 async forStaff(){
  this.checkEnabled();
  return this.db.memberPayoutRequest.findMany({where:{status:MemberPayoutStatus.REQUESTED},
   orderBy:[{createdAt:'asc'},{id:'asc'}],take:100,
   select:{id:true,amountPaise:true,status:true,createdAt:true,
    member:{select:{id:true,displayName:true,email:true}}}});
 }
 async request(actor:MemberPrincipal,input:MemberPayoutRequestDto){
  this.checkPayoutEnabled();
  if(actor.status!=='ACTIVE')throw new ForbiddenException('An active member account is required');
  try{
   return await this.db.$transaction(async tx=>{
    // Serialize ALL reservations and legacy earning settlements for this member.
    const locked=await tx.$queryRaw<Array<{status:string}>>`SELECT status FROM member_accounts WHERE id=${actor.id} FOR UPDATE`;
    if(locked.length!==1)throw new NotFoundException('Member not found');
    // The guard's earlier ACTIVE state can become stale while waiting for this lock.
    if(locked[0].status!=='ACTIVE')
     throw new ForbiddenException('An active member account is required');
    const existing=await tx.memberPayoutRequest.findUnique({where:{requestKey:input.requestKey}});
    if(existing){
     if(existing.memberId===actor.id&&existing.amountPaise===input.amountPaise)return existing;
     throw new ConflictException('Payout request key has already been used');
    }
    const totals=await this.amounts(tx,actor.id);
    if(input.amountPaise>totals.availablePaise)
     throw new ConflictException('Insufficient available wallet balance');
    const payout=await tx.memberPayoutRequest.create({data:{
     id:randomUUID(),memberId:actor.id,requestKey:input.requestKey,
     amountPaise:input.amountPaise
    }});
    await tx.memberAudit.create({data:{id:randomUUID(),memberId:actor.id,action:'WALLET_PAYOUT_REQUESTED'}});
    return payout;
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }catch(error){
   if((error as {code?:string}).code==='P2002'||(error as {code?:string}).code==='P2034')
    throw new ConflictException('Payout request changed; refresh wallet and retry');
   throw error;
  }
 }
 async decide(id:string,input:MemberPayoutDecisionDto,actor:StaffPrincipal){
  this.checkPayoutEnabled();
  const isPaid=input.status==='PAID';
  const reference=input.settlementReference?.trim().toUpperCase();
  const evidence=input.settlementEvidenceRef?.trim().toUpperCase();
  const date=input.paidAt?new Date(input.paidAt):null;
  const reason=input.rejectionReason?.trim();
  if(isPaid){
   if(!reference||!evidence||!date||!Number.isFinite(date.getTime())||date.getTime()>Date.now()||reason)
    throw new BadRequestException('Recorded payout requires actual external transfer evidence and time');
  }else if(!reason||reference||evidence||date){
   throw new BadRequestException('Rejection requires a reason and no transfer evidence');
  }
  try{
   return await this.db.$transaction(async tx=>{
    const located=await tx.memberPayoutRequest.findUnique({where:{id},select:{memberId:true}});
    if(!located)throw new NotFoundException('Payout request not found');
    await tx.$queryRaw`SELECT id FROM member_accounts WHERE id=${located.memberId} FOR UPDATE`;
    const payout=await tx.memberPayoutRequest.findUniqueOrThrow({where:{id}});
    if(payout.status!==MemberPayoutStatus.REQUESTED){
     if(payout.status===input.status&&payout.decisionRequestKey===input.decisionRequestKey&&
        (isPaid?payout.settlementReference===reference&&
          payout.settlementEvidenceRef===evidence&&payout.paidAt?.getTime()===date?.getTime():
          payout.rejectionReason===reason))return payout;
     throw new ConflictException('Payout has already been decided');
    }
    if(isPaid){
     await tx.financialSettlementReference.create({data:{
      reference:reference!,sourceId:id,sourceKind:FinancialSettlementKind.PAYOUT
     }});
    }
    const decidedAt=new Date();
    const updated=await tx.memberPayoutRequest.update({where:{id},data:{
     status:isPaid?MemberPayoutStatus.PAID:MemberPayoutStatus.REJECTED,
     decisionRequestKey:input.decisionRequestKey,decidedAt,decidedById:actor.id,
     ...(isPaid?{settlementReference:reference!,settlementEvidenceRef:evidence!,paidAt:date!}:
      {rejectionReason:reason!})
    }});
    await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,
     action:isPaid?'MEMBER_PAYOUT_RECORDED':'MEMBER_PAYOUT_REJECTED',
     objectType:'MEMBER_PAYOUT',objectId:id,
     summary:isPaid?'External wallet payout recorded with evidence':
      'Payout request rejected and reservation released'}});
    await tx.memberAudit.create({data:{id:randomUUID(),memberId:payout.memberId,
     action:isPaid?'WALLET_PAYOUT_PAID':'WALLET_PAYOUT_REJECTED'}});
    return updated;
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }catch(error){
   if(['P2002','P2034'].includes((error as {code?:string}).code??''))
    throw new ConflictException('Payout decision or settlement reference already used');
   throw error;
  }
 }
}
