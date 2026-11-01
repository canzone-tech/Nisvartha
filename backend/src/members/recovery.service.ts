import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException,ServiceUnavailableException,UnauthorizedException} from '@nestjs/common';
import {MemberAccountStatus,Prisma} from '@prisma/client';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import * as argon2 from 'argon2';
import {PrismaService} from '../database/prisma.service';
import {StaffPrincipal} from '../staff/staff.dto';
import {IssueMemberRecoveryDto,RedeemMemberRecoveryDto} from './recovery.dto';

const hashCode=(value:string)=>createHash('sha256').update('nisvartha:member-recovery:v1:'+value).digest('hex');
const HASH_OPTIONS={type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1} as const;
const RECOVERY_MINUTES=15;
const REISSUE_MINUTES=5;
const acceptable=[MemberAccountStatus.PENDING,MemberAccountStatus.ACTIVE];

@Injectable()
export class MemberRecoveryService {
 constructor(private readonly db:PrismaService){}
 private enabled(){
  if(process.env.MEMBER_PORTAL_ENABLED!=='true'||process.env.MEMBER_RECOVERY_ENABLED!=='true')
   throw new ServiceUnavailableException('Member credential recovery is disabled');
 }
 async issue(memberId:string,dto:IssueMemberRecoveryDto,staff:StaffPrincipal){
  this.enabled();
  if(!dto.identityVerified)throw new BadRequestException('Identity must be independently verified before issuing recovery');
  const rawCode=randomBytes(32).toString('base64url');
  const now=new Date(),expiresAt=new Date(now.getTime()+RECOVERY_MINUTES*60_000);
  await this.db.$transaction(async tx=>{
   const locked=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM member_accounts WHERE id=${memberId} FOR UPDATE`;
   if(!locked.length)throw new NotFoundException('Member account not found');
   const member=await tx.memberAccount.findUniqueOrThrow({where:{id:memberId}});
   if(!acceptable.includes(member.status))throw new ForbiddenException('Recovery unavailable for this account');
   const last=await tx.memberPasswordRecovery.findFirst({where:{memberId},orderBy:{createdAt:'desc'},select:{createdAt:true}});
   if(last&&last.createdAt.getTime()>now.getTime()-REISSUE_MINUTES*60_000)
    throw new ConflictException('A recovery code was recently issued');
   // Reissue supersedes every previous outstanding credential.
   await tx.memberPasswordRecovery.updateMany({where:{memberId,usedAt:null},data:{usedAt:now}});
   await tx.memberPasswordRecovery.create({data:{
    id:randomUUID(),memberId,issuerId:staff.id,tokenHash:hashCode(rawCode),
    identityEvidenceRef:dto.identityEvidenceRef,expiresAt
   }});
   await tx.cmsAudit.create({data:{
    id:randomUUID(),actorId:staff.id,action:'MEMBER_PASSWORD_RECOVERY_ISSUED',
    objectType:'MEMBER',objectId:memberId,
    summary:'One-time recovery issued after staff identity check (no bearer material stored)'
   }});
   await tx.memberAudit.create({data:{id:randomUUID(),memberId,action:'PASSWORD_RECOVERY_ISSUED'}});
  },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
  // Returned exactly once through authenticated ADMIN route; never log/store code.
  return {code:rawCode,expiresAt:expiresAt.toISOString(),
   delivery:'HAND_TO_VERIFIED_MEMBER_ONLY',
   message:'Deliver securely only to the independently verified account owner. Never put this code in audit notes.'};
 }
 async redeem(dto:RedeemMemberRecoveryDto){
  this.enabled();
  // Argon2 work is outside the DB row-lock critical section.
  const replacementHash=await argon2.hash(dto.newPassword,HASH_OPTIONS);
  const codeHash=hashCode(dto.code);
  const now=new Date();
  return this.db.$transaction(async tx=>{
   const locked=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM member_password_recoveries WHERE tokenHash=${codeHash} FOR UPDATE`;
   if(locked.length!==1)throw new UnauthorizedException('Invalid or expired recovery code');
   const record=await tx.memberPasswordRecovery.findUniqueOrThrow({where:{tokenHash:codeHash},include:{member:true}});
   if(record.usedAt||record.expiresAt<=now||!acceptable.includes(record.member.status))
    throw new UnauthorizedException('Invalid or expired recovery code');
   const consumed=await tx.memberPasswordRecovery.updateMany({
    where:{id:record.id,usedAt:null,expiresAt:{gt:now}},data:{usedAt:now}
   });
   if(consumed.count!==1)throw new UnauthorizedException('Invalid or expired recovery code');
   await tx.memberAccount.update({where:{id:record.memberId},data:{
    passwordHash:replacementHash,failedLogins:0,lockedUntil:null
   }});
   await tx.memberSession.updateMany({where:{memberId:record.memberId,revokedAt:null},data:{revokedAt:now}});
   await tx.memberPasswordRecovery.updateMany({where:{memberId:record.memberId,usedAt:null},data:{usedAt:now}});
   await tx.memberAudit.create({data:{id:randomUUID(),memberId:record.memberId,action:'PASSWORD_RECOVERED_SESSIONS_REVOKED'}});
   return {passwordReset:true,sessionsRevoked:true};
  },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
 }
}
