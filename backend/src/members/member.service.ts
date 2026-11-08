import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException,ServiceUnavailableException,UnauthorizedException} from '@nestjs/common';
import {MemberAccountStatus,MemberRegistrationSource,MembershipApplicationStatus,Prisma} from '@prisma/client';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import * as argon2 from 'argon2';
import {uatPinHash,uatPinRequested,assertUatPinEnvironment} from './uat-signup-policy';
import {registrationPinEnabled,registrationPinHash,assertRegistrationPinEnvironment} from './registration-pin-policy';
import {PrismaService} from '../database/prisma.service';
import {StaffPrincipal} from '../staff/staff.dto';
import {ApplicationDecisionDto,MemberLoginDto,MemberPasswordDto,MemberPrincipal,MemberProfileDto,MemberRegisterDto,MembershipReviewPageDto,StaffAssistedMemberRegisterDto} from './member.dto';
import {MatrixPlacementService} from './matrix-placement.service';
import {MemberCompensationService} from './member-compensation.service';

const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
const passwordOpts={type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1} as const;
const BAD='Invalid email or password';
const deniedStatuses:MemberAccountStatus[]=[MemberAccountStatus.SUSPENDED,MemberAccountStatus.DISABLED];
const reviewDecisions:MembershipApplicationStatus[]=[MembershipApplicationStatus.APPROVED,MembershipApplicationStatus.REJECTED];
@Injectable()
export class MemberService{
 constructor(private readonly db:PrismaService,private readonly matrix:MatrixPlacementService,
  private readonly compensation:MemberCompensationService){}
 private enabled(){if(process.env.MEMBER_PORTAL_ENABLED!=='true')throw new ServiceUnavailableException('Member portal is not enabled')}
 private newApplications(){
  this.enabled();
  if(process.env.MEMBER_APPLICATIONS_ENABLED!=='true'||!process.env.MEMBER_TERMS_VERSION||!process.env.MEMBER_PRIVACY_VERSION)
   throw new ServiceUnavailableException('Approved member application policy is not enabled');
 }
 async registerAssisted(input:StaffAssistedMemberRegisterDto,actor:StaffPrincipal){
  if(process.env.MEMBER_STAFF_REGISTRATION_ENABLED!=='true')
   throw new ServiceUnavailableException('Staff-assisted registration is not enabled');
  if(input.applicantPresent!==true)
   throw new BadRequestException('Applicant must enter their own credentials and confirm consent');
  return this.register(input,{staffId:actor.id,consentEvidenceRef:input.consentEvidenceRef});
 }
 // One authoritative transaction for public and consent-evidenced staff intake.
 async register(input:MemberRegisterDto,source?:{staffId:string;consentEvidenceRef:string}){
  this.newApplications();
  if(!input.consent||input.termsVersion!==process.env.MEMBER_TERMS_VERSION||input.privacyVersion!==process.env.MEMBER_PRIVACY_VERSION)
   throw new BadRequestException('Current approved terms and privacy consent required');
  const useUatPin=uatPinRequested(),useAccessPin=registrationPinEnabled();
  if(useUatPin&&useAccessPin)throw new ServiceUnavailableException('Conflicting PIN registration policies');
  if(useUatPin)assertUatPinEnvironment();
  if(useAccessPin)assertRegistrationPinEnvironment();
  if((useUatPin||useAccessPin)&&!input.registrationPin)
   throw new BadRequestException('A valid one-time registration PIN is required');
  if(!useUatPin&&!useAccessPin&&input.registrationPin)
   throw new BadRequestException('PIN registration is not enabled');
  if(!useUatPin&&!useAccessPin&&input.inviteCode)
   throw new BadRequestException('Inviter registration is not enabled');
  const email=input.email.trim().toLowerCase();
  // Disposable UAT must never accept actual applicant addresses, even if a
  // synthetic PIN is presented; this is not a real public enrollment route.
  if(useUatPin&&!email.endsWith('@example.invalid'))
   throw new BadRequestException('Synthetic membership UAT requires example.invalid email');
  const hash=await argon2.hash(input.password,passwordOpts);
  try{
   return await this.db.$transaction(async tx=>{
    const id=randomUUID(),applicationId=randomUUID();
    if(useUatPin){
     const tokenHash=uatPinHash(input.registrationPin!);
     const rows=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM uat_signup_pins WHERE tokenHash=${tokenHash} FOR UPDATE`;
     if(rows.length!==1)throw new BadRequestException('Invalid or unavailable registration PIN');
     const pin=await tx.uatSignupPin.findUnique({where:{tokenHash}});
     if(!pin||pin.redeemedAt||pin.expiresAt<=new Date())
      throw new BadRequestException('Invalid or unavailable registration PIN');
    }
    if(useAccessPin){
     const tokenHash=registrationPinHash(input.registrationPin!);
     const rows=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM registration_pins WHERE tokenHash=${tokenHash} FOR UPDATE`;
     if(rows.length!==1)throw new BadRequestException('Invalid or unavailable registration PIN');
     const pin=await tx.registrationPin.findUnique({where:{tokenHash}});
     if(!pin||pin.redeemedAt||pin.expiresAt<=new Date())
      throw new BadRequestException('Invalid or unavailable registration PIN');
    }
    let inviterId:string|undefined;
    if((useUatPin||useAccessPin)&&input.inviteCode){
     const inviter=await tx.memberAccount.findUnique({where:{referralCode:input.inviteCode},
      include:{application:{select:{status:true}}}});
     if(!inviter||inviter.status!==MemberAccountStatus.ACTIVE||
       inviter.application?.status!==MembershipApplicationStatus.APPROVED)
      throw new BadRequestException('Invalid or unavailable inviter code');
     inviterId=inviter.id;
    }
    await tx.memberAccount.create({data:{
     id,email,displayName:input.displayName.trim(),passwordHash:hash,
     communicationOptIn:input.communicationOptIn,
     referralCode:randomBytes(16).toString('base64url')
    }});
    const application=await tx.membershipApplication.create({data:{
     id:applicationId,memberId:id,status:MembershipApplicationStatus.SUBMITTED,
     termsVersion:input.termsVersion,privacyVersion:input.privacyVersion,consentAt:new Date(),
     registrationSource:source?MemberRegistrationSource.STAFF_ASSISTED:MemberRegistrationSource.PUBLIC,
     registeredByStaffId:source?.staffId??null,
     consentEvidenceRef:source?.consentEvidenceRef??null
    }});
    if(useUatPin){
     const tokenHash=uatPinHash(input.registrationPin!);
     const claimed=await tx.uatSignupPin.updateMany({where:{
      tokenHash,redeemedAt:null,expiresAt:{gt:new Date()}
     },data:{redeemedAt:new Date(),redeemedByMemberId:id}});
     if(claimed.count!==1)throw new ConflictException('Registration PIN is no longer available');
    }
    if(useAccessPin){
     const tokenHash=registrationPinHash(input.registrationPin!);
     const claimed=await tx.registrationPin.updateMany({where:{
      tokenHash,redeemedAt:null,expiresAt:{gt:new Date()}
     },data:{redeemedAt:new Date(),redeemedByMemberId:id}});
     if(claimed.count!==1)throw new ConflictException('Registration PIN is no longer available');
    }
    if(inviterId){
     await tx.memberInvitation.create({data:{id:randomUUID(),inviterId,inviteeId:id}});
     await tx.memberAudit.create({data:{id:randomUUID(),memberId:id,action:'INVITATION_ATTRIBUTED'}});
    }
    await tx.memberAudit.create({data:{id:randomUUID(),memberId:id,action:'ACCOUNT_REGISTERED'}});
    if(source)await tx.cmsAudit.create({data:{
     id:randomUUID(),actorId:source.staffId,action:'MEMBER_APPLICATION_STAFF_SUBMITTED',
     objectType:'MEMBER_APPLICATION',objectId:applicationId,
     summary:'Staff-assisted nonfinancial application submitted (consent evidence held privately)'
    }});
    return {id,applicationReference:application.id,status:application.status,
     message:'Application submitted for review and offline transaction confirmation'};
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
   select:{id:true,email:true,displayName:true,status:true,communicationOptIn:true,referralCode:true,createdAt:true,
    application:{select:{id:true,status:true,termsVersion:true,privacyVersion:true,createdAt:true,decisionReason:true}}}});
  const synthetic=uatPinRequested(),access=registrationPinEnabled();
  if(synthetic&&access)throw new ServiceUnavailableException('Conflicting PIN policies');
  if(!synthetic&&!access)return {...user,referralCode:undefined};
  if(synthetic)assertUatPinEnvironment();else assertRegistrationPinEnvironment();
  const invitedCount=await this.db.memberInvitation.count({where:{inviterId:actor.id}});
  return {...user,invitedCount,referralCode:user.status===MemberAccountStatus.ACTIVE?user.referralCode:null};
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
 /**
  * Keyset pagination preserves all review items beyond legacy 100-row list.
  * Sort by creation time + unique id so equal timestamps cannot skip rows.
  * Cursor and filter are validated before querying; no snapshot is claimed
  * while operators are concurrently changing membership statuses.
  */
 async listApplicationsPage(input:MembershipReviewPageDto){
  const limit=input.limit===undefined?25:Number(input.limit);
  const where:Prisma.MembershipApplicationWhereInput={
   ...(input.status?{status:input.status}:{})
  };
  if(input.cursor){
   const anchor=await this.db.membershipApplication.findUnique({
    where:{id:input.cursor},select:{id:true,status:true,createdAt:true}
   });
   if(!anchor||(input.status&&anchor.status!==input.status))
    throw new BadRequestException('Invalid membership review cursor for selected status');
   where.OR=[
    {createdAt:{lt:anchor.createdAt}},
    {createdAt:anchor.createdAt,id:{lt:anchor.id}}
   ];
  }
  const rows=await this.db.membershipApplication.findMany({
   where,orderBy:[{createdAt:'desc'},{id:'desc'}],take:limit+1,
   select:{id:true,status:true,createdAt:true,termsVersion:true,privacyVersion:true,decisionReason:true,
    member:{select:{id:true,email:true,displayName:true,status:true}}}
  });
  const items=rows.slice(0,limit);
  return {items,nextCursor:rows.length>limit?items[items.length-1].id:null};
 }
 /**
  * Consolidate existing authoritative member and staff audit events for one
  * application. Read-only, recent bounded history; no mutation or new store.
  * Only lifecycle actions are exposed, never auth/password/recovery events.
  */
 async applicationHistory(id:string){
  const app=await this.db.membershipApplication.findUnique({
   where:{id},select:{id:true,memberId:true}
  });
  if(!app)throw new NotFoundException('Membership application not found');
  const [staffEvents,memberEvents]=await Promise.all([
   this.db.cmsAudit.findMany({
    where:{objectType:'MEMBER_APPLICATION',objectId:id,action:{in:[
     'MEMBER_APPLICATION_STAFF_SUBMITTED',
     'MEMBER_APPLICATION_REVIEW','MEMBER_APPLICATION_APPROVED',
     'MEMBER_APPLICATION_REJECTED','MEMBER_APPLICATION_SUSPENDED'
    ]}},
    select:{id:true,actorId:true,action:true,summary:true,createdAt:true},
    orderBy:[{createdAt:'desc'},{id:'desc'}],take:51
   }),
   this.db.memberAudit.findMany({
    where:{memberId:app.memberId,action:{in:['ACCOUNT_REGISTERED','APPLICATION_WITHDRAWN']}},
    select:{id:true,memberId:true,action:true,createdAt:true},
    orderBy:[{createdAt:'desc'},{id:'desc'}],take:51
   })
  ]);
  const events=[
   ...staffEvents.map(event=>({
    id:event.id,actorId:event.actorId,actorKind:'STAFF' as const,
    action:event.action,summary:event.summary,createdAt:event.createdAt
   })),
   ...memberEvents.map(event=>({
    id:event.id,actorId:event.memberId,actorKind:'MEMBER' as const,
    action:event.action,
    summary:event.action==='ACCOUNT_REGISTERED'?'Application submitted':'Application withdrawn by member',
    createdAt:event.createdAt
   }))
  ].sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime()||
   b.id.localeCompare(a.id));
  return {applicationId:id,events:events.slice(0,50),truncated:events.length>50||
   staffEvents.length>50||memberEvents.length>50};
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
   if(application.status===MembershipApplicationStatus.APPROVED&&
      next===MembershipApplicationStatus.APPROVED&&this.compensation.enabled()){
    if(await this.compensation.activationReplayMatches(tx,application.memberId,input))
     return {id,status:MembershipApplicationStatus.APPROVED};
    throw new ConflictException('Membership approval is already recorded');
   }
   const valid=(application.status===MembershipApplicationStatus.UNDER_REVIEW&&
     reviewDecisions.includes(next))||
     (application.status===MembershipApplicationStatus.APPROVED&&next===MembershipApplicationStatus.SUSPENDED);
   if(!valid)throw new ConflictException('Invalid membership transition');
   const changed=await tx.membershipApplication.update({where:{id},data:{
    status:next,decisionReason:input.reason.trim(),reviewerId:actor.id,reviewedAt:new Date()
   }});
   if(next===MembershipApplicationStatus.APPROVED){
    if(this.compensation.enabled())await this.compensation.activate(tx,application.memberId,input,actor);
    else await this.matrix.placeApprovedMember(tx,application.memberId);
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
