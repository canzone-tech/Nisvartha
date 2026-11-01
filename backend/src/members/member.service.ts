import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException,ServiceUnavailableException,UnauthorizedException} from '@nestjs/common';
import {MemberAccountStatus,MembershipApplicationStatus,Prisma} from '@prisma/client';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import * as argon2 from 'argon2';
import {PrismaService} from '../database/prisma.service';
import {StaffPrincipal} from '../staff/staff.dto';
import {ApplicationDecisionDto,MemberLoginDto,MemberPasswordDto,MemberPrincipal,MemberProfileDto,MemberRegisterDto} from './member.dto';

const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
const passwordOpts={type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1} as const;
const BAD='Invalid email or password';
const deniedStatuses:MemberAccountStatus[]=[MemberAccountStatus.SUSPENDED,MemberAccountStatus.DISABLED];
const reviewDecisions:MembershipApplicationStatus[]=[MembershipApplicationStatus.APPROVED,MembershipApplicationStatus.REJECTED];
@Injectable()
export class MemberService{
 constructor(private readonly db:PrismaService){}
 private enabled(){if(process.env.MEMBER_PORTAL_ENABLED!=='true')throw new ServiceUnavailableException('Member portal is not enabled')}
 private newApplications(){
  this.enabled();
  if(process.env.MEMBER_APPLICATIONS_ENABLED!=='true'||!process.env.MEMBER_TERMS_VERSION||!process.env.MEMBER_PRIVACY_VERSION)
   throw new ServiceUnavailableException('Approved member application policy is not enabled');
 }
 async register(input:MemberRegisterDto){
  this.newApplications();
  if(!input.consent||input.termsVersion!==process.env.MEMBER_TERMS_VERSION||input.privacyVersion!==process.env.MEMBER_PRIVACY_VERSION)
   throw new BadRequestException('Current approved terms and privacy consent required');
  const email=input.email.trim().toLowerCase();
  const hash=await argon2.hash(input.password,passwordOpts);
  try{
   return await this.db.$transaction(async tx=>{
    const id=randomUUID(),applicationId=randomUUID();
    await tx.memberAccount.create({data:{
     id,email,displayName:input.displayName.trim(),passwordHash:hash,
     communicationOptIn:input.communicationOptIn
    }});
    const application=await tx.membershipApplication.create({data:{
     id:applicationId,memberId:id,status:MembershipApplicationStatus.SUBMITTED,
     termsVersion:input.termsVersion,privacyVersion:input.privacyVersion,consentAt:new Date()
    }});
    await tx.memberAudit.create({data:{id:randomUUID(),memberId:id,action:'ACCOUNT_REGISTERED'}});
    return {id,applicationReference:application.id,status:application.status,
     message:'Application submitted for review; no financial entitlement or activation granted'};
   });
  }catch(error){
   if((error as {code?:string}).code==='P2002')throw new ConflictException('Account already exists');
   throw error;
  }
 }
 async login(input:MemberLoginDto){
  this.enabled();
  const member=await this.db.memberAccount.findUnique({where:{email:input.email.trim().toLowerCase()}});
  if(!member||deniedStatuses.includes(member.status)){
   const dummy=await argon2.hash('nonexistent-account',passwordOpts);
   await argon2.verify(dummy,input.password);
   throw new UnauthorizedException(BAD);
  }
  if(member.lockedUntil&&member.lockedUntil>new Date())throw new UnauthorizedException(BAD);
  if(!await argon2.verify(member.passwordHash,input.password)){
   const failed=await this.db.memberAccount.update({where:{id:member.id},data:{failedLogins:{increment:1}},select:{failedLogins:true}});
   if(failed.failedLogins>=5)await this.db.memberAccount.update({where:{id:member.id},data:{lockedUntil:new Date(Date.now()+15*60_000)}});
   throw new UnauthorizedException(BAD);
  }
  const token=randomBytes(32).toString('base64url'),expiresAt=new Date(Date.now()+8*60*60_000);
  await this.db.$transaction(async tx=>{
   await tx.memberAccount.update({where:{id:member.id},data:{failedLogins:0,lockedUntil:null,lastLoginAt:new Date()}});
   await tx.memberSession.create({data:{id:randomUUID(),memberId:member.id,tokenHash:digest(token),expiresAt}});
   await tx.memberAudit.create({data:{id:randomUUID(),memberId:member.id,action:'LOGIN'}});
  });
  return {accessToken:token,expiresAt:expiresAt.toISOString(),member:{id:member.id,displayName:member.displayName,status:member.status}};
 }
 async authenticate(header:string|undefined):Promise<MemberPrincipal>{
  this.enabled();
  if(!header?.startsWith('Bearer '))throw new UnauthorizedException();
  const token=header.slice(7);
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new UnauthorizedException();
  const session=await this.db.memberSession.findUnique({where:{tokenHash:digest(token)},include:{member:true}});
  if(!session||session.revokedAt||session.expiresAt<=new Date()||
     deniedStatuses.includes(session.member.status))
   throw new UnauthorizedException('Member session invalid');
  return {id:session.member.id,email:session.member.email,status:session.member.status};
 }
 async me(actor:MemberPrincipal){
  const user=await this.db.memberAccount.findUniqueOrThrow({where:{id:actor.id},
   select:{id:true,email:true,displayName:true,status:true,communicationOptIn:true,createdAt:true,
    application:{select:{id:true,status:true,termsVersion:true,privacyVersion:true,createdAt:true,decisionReason:true}}}});
  return user;
 }
 async updateProfile(actor:MemberPrincipal,input:MemberProfileDto){
  return this.db.$transaction(async tx=>{
   const user=await tx.memberAccount.update({where:{id:actor.id},data:{
    displayName:input.displayName.trim(),communicationOptIn:input.communicationOptIn
   },select:{id:true,email:true,displayName:true,communicationOptIn:true,status:true}});
   await tx.memberAudit.create({data:{id:randomUUID(),memberId:actor.id,action:'PROFILE_UPDATED'}});
   return user;
  });
 }
 async changePassword(actor:MemberPrincipal,input:MemberPasswordDto){
  const user=await this.db.memberAccount.findUniqueOrThrow({where:{id:actor.id}});
  if(!await argon2.verify(user.passwordHash,input.currentPassword))
   throw new UnauthorizedException('Current password invalid');
  if(input.newPassword===input.currentPassword)throw new BadRequestException('Use a new password');
  const hash=await argon2.hash(input.newPassword,passwordOpts);
  return this.db.$transaction(async tx=>{
   const updated=await tx.memberAccount.updateMany({where:{id:actor.id,passwordHash:user.passwordHash},data:{passwordHash:hash}});
   if(updated.count!==1)throw new ConflictException('Credentials changed; please sign in again');
   await tx.memberSession.updateMany({where:{memberId:actor.id,revokedAt:null},data:{revokedAt:new Date()}});
   await tx.memberAudit.create({data:{id:randomUUID(),memberId:actor.id,action:'PASSWORD_CHANGED_SESSIONS_REVOKED'}});
   return {sessionsRevoked:true};
  });
 }
 async logout(actor:MemberPrincipal,header:string|undefined){
  if(!header?.startsWith('Bearer '))throw new UnauthorizedException();
  return this.db.$transaction(async tx=>{
   await tx.memberSession.updateMany({where:{memberId:actor.id,tokenHash:digest(header.slice(7)),revokedAt:null},data:{revokedAt:new Date()}});
   await tx.memberAudit.create({data:{id:randomUUID(),memberId:actor.id,action:'LOGOUT'}});
   return {revoked:true};
  });
 }
 async withdraw(actor:MemberPrincipal){
  return this.db.$transaction(async tx=>{
   const app=await tx.membershipApplication.findUnique({where:{memberId:actor.id}});
   if(!app)throw new NotFoundException();
   const changed=await tx.membershipApplication.updateMany({where:{
    id:app.id,status:{in:[MembershipApplicationStatus.SUBMITTED,MembershipApplicationStatus.UNDER_REVIEW,MembershipApplicationStatus.APPROVED]}
   },data:{status:MembershipApplicationStatus.WITHDRAWN}});
   if(changed.count!==1)throw new ConflictException('This application cannot be withdrawn');
   await tx.memberAccount.update({where:{id:actor.id},data:{status:MemberAccountStatus.DISABLED}});
   await tx.memberSession.updateMany({where:{memberId:actor.id,revokedAt:null},data:{revokedAt:new Date()}});
   await tx.memberAudit.create({data:{id:randomUUID(),memberId:actor.id,action:'APPLICATION_WITHDRAWN'}});
   return {status:MembershipApplicationStatus.WITHDRAWN,sessionsRevoked:true};
  });
 }
 async listApplications(){
  return this.db.membershipApplication.findMany({orderBy:{createdAt:'desc'},take:100,
   select:{id:true,status:true,createdAt:true,termsVersion:true,privacyVersion:true,decisionReason:true,
    member:{select:{id:true,email:true,displayName:true,status:true}}}});
 }
 async markReview(id:string,actor:StaffPrincipal){
  return this.db.$transaction(async tx=>{
   const updated=await tx.membershipApplication.updateMany({where:{id,status:MembershipApplicationStatus.SUBMITTED},
    data:{status:MembershipApplicationStatus.UNDER_REVIEW,reviewerId:actor.id,reviewedAt:new Date()}});
   if(updated.count!==1)throw new ConflictException('Application is not awaiting review');
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,action:'MEMBER_APPLICATION_REVIEW',
    objectType:'MEMBER_APPLICATION',objectId:id,summary:'Application taken under review'}});
   return {id,status:MembershipApplicationStatus.UNDER_REVIEW};
  });
 }
 async decide(id:string,input:ApplicationDecisionDto,actor:StaffPrincipal){
  const next=input.status;
  return this.db.$transaction(async tx=>{
   // Serialize all review/state decisions under a lock on the authoritative application.
   const locked=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM membership_applications WHERE id=${id} FOR UPDATE`;
   if(!locked.length)throw new NotFoundException('Membership application not found');
   const application=await tx.membershipApplication.findUniqueOrThrow({where:{id}});
   const valid=(application.status===MembershipApplicationStatus.UNDER_REVIEW&&
     reviewDecisions.includes(next))||
     (application.status===MembershipApplicationStatus.APPROVED&&next===MembershipApplicationStatus.SUSPENDED);
   if(!valid)throw new ConflictException('Invalid membership transition');
   const changed=await tx.membershipApplication.update({where:{id},data:{
    status:next,decisionReason:input.reason.trim(),reviewerId:actor.id,reviewedAt:new Date()
   }});
   if(next===MembershipApplicationStatus.APPROVED){
    await tx.memberAccount.update({where:{id:application.memberId},data:{status:MemberAccountStatus.ACTIVE}});
   }else if(next===MembershipApplicationStatus.SUSPENDED){
    await tx.memberAccount.update({where:{id:application.memberId},data:{status:MemberAccountStatus.SUSPENDED}});
    await tx.memberSession.updateMany({where:{memberId:application.memberId,revokedAt:null},data:{revokedAt:new Date()}});
   }
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,action:'MEMBER_APPLICATION_'+next,
    objectType:'MEMBER_APPLICATION',objectId:id,summary:'Application decision recorded (reason held privately)'}});
   return {id,status:changed.status};
  },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
 }
}
