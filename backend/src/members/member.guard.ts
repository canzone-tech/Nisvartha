import {CanActivate,ExecutionContext,Injectable,NotFoundException} from '@nestjs/common';
import {MemberPrincipal} from './member.dto';
import {MemberService} from './member.service';
export type MemberRequest={headers:{authorization?:string};member?:MemberPrincipal};
/** Deny anonymous registration before Nest's request-body ValidationPipe.
 * Without this route guard, invalid payloads return 400 even when signup is closed.
 * Staff-assisted registration has its own staff-authenticated route and is unaffected.
 */
@Injectable()
export class PublicRegistrationGuard implements CanActivate{
 canActivate(){
  if(process.env.MEMBER_PUBLIC_REGISTRATION_ENABLED!=='true')
   throw new NotFoundException('Public member registration is closed');
  return true;
 }
}
@Injectable()
export class MemberGuard implements CanActivate{
 constructor(private readonly members:MemberService){}
 async canActivate(context:ExecutionContext){
  const req=context.switchToHttp().getRequest<MemberRequest>();
  req.member=await this.members.authenticate(req.headers.authorization);
  return true;
 }
}
