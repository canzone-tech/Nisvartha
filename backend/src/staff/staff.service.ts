import {BadRequestException,ConflictException,ForbiddenException,Injectable,UnauthorizedException} from '@nestjs/common';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {EnquiryCategory,EnquiryStatus,MembershipApplicationStatus,MemberAccountStatus,StaffRole,StaffStatus} from '@prisma/client';
import * as argon2 from 'argon2';
import {PrismaService} from '../database/prisma.service';
import {StaffLoginDto,StaffPasswordChangeDto,StaffPrincipal,StaffUpdateDto} from './staff.dto';

const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
const BAD_CREDENTIALS='Invalid email or password';
const PASSWORD_OPTIONS={type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1} as const;

@Injectable()
export class StaffService{
 constructor(private readonly db:PrismaService){}
 async login(dto:StaffLoginDto){
  const email=dto.email.trim().toLowerCase();
  const staff=await this.db.staffUser.findUnique({where:{email}});
  if(!staff || staff.status!==StaffStatus.ACTIVE){
   // Normalize the expensive validation path to limit email enumeration.
   const dummy=await argon2.hash('unused-dummy-password',PASSWORD_OPTIONS);
   await argon2.verify(dummy,dto.password);
   throw new UnauthorizedException(BAD_CREDENTIALS);
  }
  if(staff.lockedUntil && staff.lockedUntil>new Date())throw new UnauthorizedException(BAD_CREDENTIALS);
  const valid=await argon2.verify(staff.passwordHash,dto.password);
  if(!valid){
   const failed=await this.db.staffUser.update({where:{id:staff.id},data:{failedLogins:{increment:1}},select:{failedLogins:true}});
   if(failed.failedLogins>=5)await this.db.staffUser.update({where:{id:staff.id},data:{lockedUntil:new Date(Date.now()+15*60_000)}});
   throw new UnauthorizedException(BAD_CREDENTIALS);
  }
  const token=randomBytes(32).toString('base64url');
  const expiresAt=new Date(Date.now()+8*60*60_000);
  await this.db.$transaction(async tx=>{
   const unchanged=await tx.staffUser.updateMany({where:{id:staff.id,passwordHash:staff.passwordHash,status:StaffStatus.ACTIVE},data:{failedLogins:0,lockedUntil:null,lastLoginAt:new Date()}});
    if(unchanged.count!==1)throw new UnauthorizedException(BAD_CREDENTIALS);
   await tx.staffSession.create({data:{id:randomUUID(),staffId:staff.id,tokenHash:digest(token),expiresAt}});
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:staff.id,action:'LOGIN',objectType:'STAFF',objectId:staff.id,summary:'Staff login succeeded'}});
  });
  return {accessToken:token,expiresAt:expiresAt.toISOString(),passwordChangeRequired:staff.mustChangePassword,user:{id:staff.id,email:staff.email,displayName:staff.displayName,role:staff.role}};
 }
 async authenticate(bearer:string|undefined):Promise<StaffPrincipal>{
  if(!bearer?.startsWith('Bearer '))throw new UnauthorizedException();
  const token=bearer.slice(7);
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new UnauthorizedException();
  const session=await this.db.staffSession.findUnique({where:{tokenHash:digest(token)},include:{staff:true}});
  if(!session || session.revokedAt || session.expiresAt<=new Date() || session.staff.status!==StaffStatus.ACTIVE)
   throw new UnauthorizedException('Session expired or revoked');
  return {id:session.staff.id,email:session.staff.email,role:session.staff.role,mustChangePassword:session.staff.mustChangePassword};
 }
 /** Authenticate the current password, change it atomically and revoke all sessions. */
 async changePassword(input:StaffPasswordChangeDto,actor:StaffPrincipal){
  const account=await this.db.staffUser.findUnique({where:{id:actor.id}});
  if(!account||account.status!==StaffStatus.ACTIVE)
   throw new UnauthorizedException('Staff account unavailable');
  if(!await argon2.verify(account.passwordHash,input.currentPassword))
   throw new UnauthorizedException('Current password invalid');
  if(input.newPassword===input.currentPassword)
   throw new BadRequestException('Choose a new password');
  const nextHash=await argon2.hash(input.newPassword,PASSWORD_OPTIONS);
  return this.db.$transaction(async tx=>{
   const changed=await tx.staffUser.updateMany({
    where:{id:actor.id,passwordHash:account.passwordHash,status:StaffStatus.ACTIVE},
    data:{passwordHash:nextHash,mustChangePassword:false,failedLogins:0,lockedUntil:null}
   });
   if(changed.count!==1)throw new ConflictException('Credentials changed; sign in again');
   await tx.staffSession.updateMany({where:{staffId:actor.id,revokedAt:null},
    data:{revokedAt:new Date()}});
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,
    action:'ADMIN_PASSWORD_CHANGED',objectType:'STAFF',objectId:actor.id,
    summary:'Administrator changed password; all sessions revoked'}});
   return {sessionsRevoked:true};
  });
 }
 async logout(bearer:string|undefined,actor:StaffPrincipal){
  if(!bearer?.startsWith('Bearer '))throw new UnauthorizedException();
  const tokenHash=digest(bearer.slice(7));
  await this.db.$transaction(async tx=>{
   await tx.staffSession.updateMany({where:{tokenHash,staffId:actor.id,revokedAt:null},data:{revokedAt:new Date()}});
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,action:'LOGOUT',objectType:'STAFF',objectId:actor.id,summary:'Staff session revoked'}});
  });
  return {revoked:true};
 }
 async overview(){
  const [members,pendingApplications,newContacts,newVolunteers]=await Promise.all([
   this.db.memberAccount.count({where:{status:MemberAccountStatus.ACTIVE}}),
   this.db.membershipApplication.count({where:{status:{in:[MembershipApplicationStatus.SUBMITTED,MembershipApplicationStatus.UNDER_REVIEW]}}}),
   this.db.enquiry.count({where:{category:EnquiryCategory.CONTACT,status:EnquiryStatus.NEW}}),
   this.db.enquiry.count({where:{category:EnquiryCategory.VOLUNTEER,status:EnquiryStatus.NEW}})
  ]);
  return {members,pendingApplications,newContacts,newVolunteers};
 }
 async listStaff(){return this.db.staffUser.findMany({select:{id:true,email:true,displayName:true,role:true,status:true,createdAt:true},orderBy:{createdAt:'asc'}})}
 async updateStaff(id:string,dto:StaffUpdateDto,actor:StaffPrincipal){
  // Only retiring legacy extra ADMIN accounts is supported. A disabled account
  // cannot be reactivated or duplicated through the live control plane.
  if(dto.status!==StaffStatus.DISABLED)throw new ForbiddenException('Only administrator retirement is allowed');
  if(id===actor.id)throw new ForbiddenException('Cannot change your own status');
  return this.db.$transaction(async tx=>{
   // Lock all active admins first so concurrent deactivations cannot remove the final administrator.
   const active=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM staff_users WHERE role='ADMIN' AND status='ACTIVE' ORDER BY id FOR UPDATE`;
   const principal=await tx.staffUser.findUnique({where:{id:actor.id}});
   if(!principal||principal.status!==StaffStatus.ACTIVE||principal.role!==StaffRole.ADMIN)
    throw new ForbiddenException('Administrator is no longer active');
   const current=await tx.staffUser.findUnique({where:{id}});
   if(!current)throw new ConflictException('Admin account not found');
   if(current.status===StaffStatus.ACTIVE&&dto.status===StaffStatus.DISABLED&&active.length<=1)
    throw new ForbiddenException('Cannot disable the last active administrator');
   if(current.status===dto.status)return {id,role:StaffRole.ADMIN,status:current.status};
   await tx.staffUser.update({where:{id},data:{status:dto.status}});
   await tx.staffSession.updateMany({where:{staffId:id,revokedAt:null},data:{revokedAt:new Date()}});
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,action:'ADMIN_STATUS',objectType:'STAFF',objectId:id,summary:'Admin status '+current.status+' -> '+dto.status+'; sessions revoked'}});
   return {id,role:StaffRole.ADMIN,status:dto.status};
  });
 }
}
