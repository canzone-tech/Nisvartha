import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException,ServiceUnavailableException} from '@nestjs/common';
import {MemberAccountStatus,MembershipApplicationStatus,Prisma,UatScenarioEntryKind} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {PrismaService} from '../database/prisma.service';
import {isDisposableUatDatabase} from '../security/disposable-uat';
import {FLYER_MATRIX_REFERENCE} from '../security/matrix-simulation';
import type {MemberPrincipal} from '../members/member.dto';
import type {StaffPrincipal} from './staff.dto';
const JOIN=UatScenarioEntryKind.JOINING_REFERENCE;
const DIRECT=UatScenarioEntryKind.DIRECT_REFERRAL_REFERENCE;
const reference={joiningInr:FLYER_MATRIX_REFERENCE.joiningAmountINR,
 directReferralInr:FLYER_MATRIX_REFERENCE.directReferralINR,
 levelPayoutsInr:[...FLYER_MATRIX_REFERENCE.levelPayoutsINR]};
@Injectable()
export class UatScenarioService{
 constructor(private readonly db:PrismaService){}
 private guard(){
  if(process.env.NISVARTHA_UAT_FINANCE!=='synthetic'||
     process.env.NISVARTHA_UAT_PLAN!=='synthetic'||
     process.env.NISVARTHA_UAT_PIN_REGISTRATION!=='synthetic'||
     !isDisposableUatDatabase())
   throw new ServiceUnavailableException('Local-only scenario finance is disabled');
 }
 async forMember(actor:MemberPrincipal){
  this.guard();
  if(actor.status!==MemberAccountStatus.ACTIVE)
   throw new ForbiddenException('Only approved synthetic members can view scenarios');
  return this.read(actor.id);
 }
 async forStaff(memberId:string){this.guard();return this.read(memberId)}
 private async read(memberId:string){
  const account=await this.db.memberAccount.findUnique({where:{id:memberId},
   select:{id:true,email:true}});
  if(!account)throw new NotFoundException('Synthetic member not found');
  if(!account.email.endsWith('@example.invalid'))
   throw new ForbiddenException('Scenario only allows fictional members');
  // History is paginated, but aggregate totals must cover ALL authoritative
  // records, not only the latest page. Read inside one repeatable snapshot.
  const historyPageSize=200;
  const where={beneficiaryMemberId:memberId};
  const [page,joiningCount,directTotals]=await this.db.$transaction([
   this.db.uatScenarioEntry.findMany({
    where,orderBy:[{createdAt:'desc'},{id:'desc'}],
    take:historyPageSize+1,
    select:{id:true,kind:true,amountPaise:true,createdAt:true,sourceMemberId:true}
   }),
   this.db.uatScenarioEntry.count({where:{...where,kind:JOIN}}),
   this.db.uatScenarioEntry.aggregate({
    where:{...where,kind:DIRECT},
    _count:{_all:true},_sum:{amountPaise:true}
   })
  ],{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  const entries=page.slice(0,historyPageSize);
  return {status:'LOCAL_SYNTHETIC_REFERENCE_ONLY' as const,
   canAcceptPayment:false,canCredit:false,canWithdraw:false,
   reference,memberId,
   joiningRecorded:joiningCount>0,
   directReferralEvents:directTotals._count._all,
   directReferralReferencePaise:directTotals._sum.amountPaise??0,
   entries:entries.map(e=>({id:e.id,kind:e.kind,amountPaise:e.amountPaise,
    createdAt:e.createdAt,sourceMemberId:e.sourceMemberId})),
   truncated:page.length>historyPageSize
  };
 }
 /** Explicit, idempotent fictional joining/reference recording. No funds move. */
 async record(memberId:string,requestKey:string,actor:StaffPrincipal){
  this.guard();
  const existing=await this.db.uatScenarioEntry.findUnique({where:{requestKey}});
  if(existing){
   if(existing.kind!==JOIN||existing.sourceMemberId!==memberId)
    throw new ConflictException('Scenario request key already used');
   return this.read(memberId);
  }
  try{
   await this.db.$transaction(async tx=>{
    const member=await tx.memberAccount.findUnique({
     where:{id:memberId},include:{application:{select:{status:true}}}});
    if(!member||!member.email.endsWith('@example.invalid')||
       member.status!==MemberAccountStatus.ACTIVE||
       member.application?.status!==MembershipApplicationStatus.APPROVED)
     throw new BadRequestException('Requires approved fictional member');
    const prior=await tx.uatScenarioEntry.findUnique({
     where:{kind_sourceMemberId:{kind:JOIN,sourceMemberId:memberId}}});
    if(prior){
     if(prior.requestKey!==requestKey)
      throw new ConflictException('Joining reference already recorded');
     return;
    }
    await tx.uatScenarioEntry.create({data:{
     id:randomUUID(),kind:JOIN,sourceMemberId:memberId,
     beneficiaryMemberId:memberId,recordedByStaffId:actor.id,
     requestKey,amountPaise:reference.joiningInr*100
    }});
    const edge=await tx.memberInvitation.findUnique({
     where:{inviteeId:memberId},
     include:{inviter:{include:{application:{select:{status:true}}}}}});
    const inviter=edge?.inviter;
    if(inviter?.email.endsWith('@example.invalid')&&
       inviter.status===MemberAccountStatus.ACTIVE&&
       inviter.application?.status===MembershipApplicationStatus.APPROVED){
     await tx.uatScenarioEntry.create({data:{
      id:randomUUID(),kind:DIRECT,sourceMemberId:memberId,
      beneficiaryMemberId:inviter.id,recordedByStaffId:actor.id,
      amountPaise:reference.directReferralInr*100
     }});
    }
    await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,
     action:'UAT_JOINING_REFERENCE_RECORDED',objectType:'UAT_SCENARIO',
     objectId:memberId,
     summary:'Owner-confirmed flyer amounts; synthetic-only reference, no payment settled or commission credited'}});
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }catch(err){
   if((err as {code?:string}).code==='P2002'){
    const prior=await this.db.uatScenarioEntry.findUnique({where:{requestKey}});
    if(prior?.kind===JOIN&&prior.sourceMemberId===memberId)return this.read(memberId);
    throw new ConflictException('Scenario already recorded');
   }
   throw err;
  }
  return this.read(memberId);
 }
}
