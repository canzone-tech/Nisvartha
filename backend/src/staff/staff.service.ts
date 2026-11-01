import {ConflictException,ForbiddenException,Injectable,UnauthorizedException} from '@nestjs/common';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {StaffRole,StaffStatus} from '@prisma/client';
import * as argon2 from 'argon2';
import {PrismaService} from '../database/prisma.service';
import {StaffCreateDto,StaffLoginDto,StaffPrincipal,StaffUpdateDto} from './staff.dto';

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
   await tx.staffUser.update({where:{id:staff.id},data:{failedLogins:0,lockedUntil:null,lastLoginAt:new Date()}});
   await tx.staffSession.create({data:{id:randomUUID(),staffId:staff.id,tokenHash:digest(token),expiresAt}});
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:staff.id,action:'LOGIN',objectType:'STAFF',objectId:staff.id,summary:'Staff login succeeded'}});
  });
  return {accessToken:token,expiresAt:expiresAt.toISOString(),user:{id:staff.id,email:staff.email,displayName:staff.displayName,role:staff.role}};
 }
 async authenticate(bearer:string|undefined):Promise<StaffPrincipal>{
  if(!bearer?.startsWith('Bearer '))throw new UnauthorizedException();
  const token=bearer.slice(7);
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new UnauthorizedException();
  const session=await this.db.staffSession.findUnique({where:{tokenHash:digest(token)},include:{staff:true}});
  if(!session || session.revokedAt || session.expiresAt<=new Date() || session.staff.status!==StaffStatus.ACTIVE)
   throw new UnauthorizedException('Session expired or revoked');
  return {id:session.staff.id,email:session.staff.email,role:session.staff.role};
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
 async listStaff(){return this.db.staffUser.findMany({select:{id:true,email:true,displayName:true,role:true,status:true,createdAt:true},orderBy:{createdAt:'asc'}})}
 async createStaff(dto:StaffCreateDto,actor:StaffPrincipal){
  if(dto.role===StaffRole.SUPER_ADMIN)throw new ForbiddenException('SUPER_ADMIN provisioning requires trusted-host bootstrap');
  const email=dto.email.trim().toLowerCase();
  const hash=await argon2.hash(dto.password,PASSWORD_OPTIONS);
  try{return await this.db.$transaction(async tx=>{
   const staff=await tx.staffUser.create({data:{id:randomUUID(),email,displayName:dto.displayName.trim(),passwordHash:hash,role:dto.role}});
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,action:'STAFF_CREATE',objectType:'STAFF',objectId:staff.id,summary:'Staff account created with role '+dto.role}});
   return {id:staff.id,email:staff.email,role:staff.role,status:staff.status};
  })}catch(err){if((err as {code?:string}).code==='P2002')throw new ConflictException('Staff account already exists');throw err}
 }
 async updateStaff(id:string,dto:StaffUpdateDto,actor:StaffPrincipal){
  if(id===actor.id)throw new ForbiddenException('Cannot change your own permissions or status');
  if(dto.role===StaffRole.SUPER_ADMIN)throw new ForbiddenException('SUPER_ADMIN role cannot be granted through staff API');
  return this.db.$transaction(async tx=>{
   // Lock the authoritative record to prevent an ADMIN racing an offline elevation.
   const locked=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM staff_users WHERE id=${id} FOR UPDATE`;
   if(!locked.length)throw new ConflictException('Staff account not found');
   const current=await tx.staffUser.findUniqueOrThrow({where:{id}});
   if(current.role===StaffRole.SUPER_ADMIN)throw new ForbiddenException('SUPER_ADMIN role cannot be modified through staff API');
   await tx.staffUser.update({where:{id},data:{role:dto.role,status:dto.status}});
   await tx.staffSession.updateMany({where:{staffId:id,revokedAt:null},data:{revokedAt:new Date()}});
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,action:'STAFF_ROLE_STATUS',objectType:'STAFF',objectId:id,summary:'Role '+current.role+' -> '+dto.role+'; status '+current.status+' -> '+dto.status+'; sessions revoked'}});
   return {id,role:dto.role,status:dto.status};
  });
 }
}
