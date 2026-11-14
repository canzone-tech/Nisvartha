import {CanActivate,ExecutionContext,ForbiddenException,Injectable,SetMetadata,UnauthorizedException} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {StaffRole} from '@prisma/client';
import {StaffService} from './staff.service';
import {StaffPrincipal} from './staff.dto';
export const STAFF_ROLES='nisvartha:staff-roles';
const STAFF_PASSWORD_ROTATION_ALLOWED='nisvartha:staff-password-rotation-allowed';
export const AllowStaffPasswordRotation=()=>SetMetadata(STAFF_PASSWORD_ROTATION_ALLOWED,true);
export const StaffRoles=(...roles:StaffRole[])=>SetMetadata(STAFF_ROLES,roles);
export type StaffRequest={headers:{authorization?:string};staff?:StaffPrincipal};
@Injectable()
export class StaffGuard implements CanActivate{
 constructor(private readonly staffService:StaffService,private readonly reflector:Reflector){}
 async canActivate(context:ExecutionContext){
  const req=context.switchToHttp().getRequest<StaffRequest>();
  const principal=await this.staffService.authenticate(req.headers.authorization);
  const required=this.reflector.getAllAndOverride<StaffRole[]>(STAFF_ROLES,[context.getHandler(),context.getClass()]);
  // Deny by default; only the ADMIN account type can access staff endpoints.
  const allowed=Boolean(required?.includes(principal.role));
  if(!allowed)throw new ForbiddenException('Missing staff permission');
  const allowsRotation=this.reflector.getAllAndOverride<boolean>(STAFF_PASSWORD_ROTATION_ALLOWED,
   [context.getHandler(),context.getClass()]);
  if(principal.mustChangePassword&&!allowsRotation)
   throw new ForbiddenException('Administrator password change required');
  req.staff=principal;return true;
 }
}
