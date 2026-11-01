import {CanActivate,ExecutionContext,ForbiddenException,Injectable,SetMetadata,UnauthorizedException} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {StaffRole} from '@prisma/client';
import {StaffService} from './staff.service';
import {StaffPrincipal} from './staff.dto';
export const STAFF_ROLES='nisvartha:staff-roles';
export const StaffRoles=(...roles:StaffRole[])=>SetMetadata(STAFF_ROLES,roles);
export type StaffRequest={headers:{authorization?:string};staff?:StaffPrincipal};
@Injectable()
export class StaffGuard implements CanActivate{
 constructor(private readonly staffService:StaffService,private readonly reflector:Reflector){}
 async canActivate(context:ExecutionContext){
  const req=context.switchToHttp().getRequest<StaffRequest>();
  const principal=await this.staffService.authenticate(req.headers.authorization);
  const required=this.reflector.getAllAndOverride<StaffRole[]>(STAFF_ROLES,[context.getHandler(),context.getClass()]);
  if(!required?.includes(principal.role))throw new ForbiddenException('Missing staff permission');
  req.staff=principal;return true;
 }
}
