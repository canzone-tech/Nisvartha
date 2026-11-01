import {CanActivate,ExecutionContext,Injectable} from '@nestjs/common';
import {MemberPrincipal} from './member.dto';
import {MemberService} from './member.service';
export type MemberRequest={headers:{authorization?:string};member?:MemberPrincipal};
@Injectable()
export class MemberGuard implements CanActivate{
 constructor(private readonly members:MemberService){}
 async canActivate(context:ExecutionContext){
  const req=context.switchToHttp().getRequest<MemberRequest>();
  req.member=await this.members.authenticate(req.headers.authorization);
  return true;
 }
}
