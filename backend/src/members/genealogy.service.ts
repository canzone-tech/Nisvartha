import {ConflictException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {PrismaService} from '../database/prisma.service';
import {assertUatPinEnvironment} from './uat-signup-policy';
import {MemberPrincipal} from './member.dto';

// A read-only view of authoritative inviter edges. Do not confuse this with
// 1:3 paid matrix placement, commission levels or future re-entry positions.
export const GENEALOGY_MAX_LEVEL=5;
export const GENEALOGY_MAX_NODES=150;
export type GenealogyNode={
 id:string;label:string;status:string;level:number;children:GenealogyNode[];
};
export type GenealogyView={
 kind:'DIRECT_INVITATIONS';root:GenealogyNode;shown:number;
 maximumLevel:number;maximumNodes:number;truncated:boolean;
};

@Injectable()
export class GenealogyService{
 constructor(private readonly db:PrismaService){}

 async forMember(actor:MemberPrincipal):Promise<GenealogyView>{
  assertUatPinEnvironment();
  if(actor.status!=='ACTIVE')throw new ForbiddenException('Only approved members can view their invitation genealogy');
  return this.read(actor.id,false);
 }

 async forStaff(rootId:string):Promise<GenealogyView>{
  assertUatPinEnvironment();
  return this.read(rootId,true);
 }

 private async read(rootId:string,staff:boolean):Promise<GenealogyView>{
  const member=await this.db.memberAccount.findUnique({
   where:{id:rootId},select:{id:true,displayName:true,status:true}
  });
  if(!member)throw new NotFoundException('Member not found');
  const root:GenealogyNode={
   id:member.id,label:staff?member.displayName:'You',
   status:member.status,level:0,children:[]
  };
  const seen=new Set([root.id]);
  const nodes=new Map([[root.id,root]]);
  let frontier=[root.id],shown=1,truncated=false;
  for(let level=1;level<=GENEALOGY_MAX_LEVEL&&frontier.length>0;level++){
   const remaining=GENEALOGY_MAX_NODES-shown;
   if(remaining<=0){
    truncated=(await this.db.memberInvitation.count({
     where:{inviterId:{in:frontier}}
    }))>0;
    break;
   }
   const rows=await this.db.memberInvitation.findMany({
    where:{inviterId:{in:frontier}},
    select:{inviterId:true,invitee:{select:{
     id:true,displayName:true,status:true
    }}},
    orderBy:[{createdAt:'asc'},{id:'asc'}],take:remaining+1
   });
   if(rows.length>remaining)truncated=true;
   const next:string[]=[];
   for(const edge of rows.slice(0,remaining)){
    if(seen.has(edge.invitee.id))
     throw new ConflictException('Invalid invitation lineage');
    const parent=nodes.get(edge.inviterId);
    if(!parent)throw new ConflictException('Invalid invitation parent');
    const node:GenealogyNode={
     id:edge.invitee.id,
     label:staff?edge.invitee.displayName:'Member '+edge.invitee.id.slice(-6),
     status:edge.invitee.status,level,children:[]
    };
    parent.children.push(node);
    nodes.set(node.id,node);seen.add(node.id);next.push(node.id);shown++;
   }
   frontier=next;
   if(truncated)break;
   if(level===GENEALOGY_MAX_LEVEL&&frontier.length>0){
    truncated=(await this.db.memberInvitation.count({
     where:{inviterId:{in:frontier}}
    }))>0;
   }
  }
  return {kind:'DIRECT_INVITATIONS',root,shown,
   maximumLevel:GENEALOGY_MAX_LEVEL,
   maximumNodes:GENEALOGY_MAX_NODES,truncated};
 }
}
