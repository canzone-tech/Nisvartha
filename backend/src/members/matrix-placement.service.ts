import {ConflictException,ForbiddenException,Injectable,NotFoundException,ServiceUnavailableException} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {PrismaService} from '../database/prisma.service';
import {MemberPrincipal} from './member.dto';

export const MATRIX_WIDTH=3;
export const MATRIX_MAX_LEVEL=5;
export const MATRIX_MAX_NODES=364;
const LEVEL_AMOUNTS=[2500,5000,10000,50000,90000] as const;

export type MemberMatrixNode={
 positionId:string;memberId:string;label:string;status:string;
 sequence:number;slot:number;level:number;children:MemberMatrixNode[];
};
export type MemberMatrixView={
 kind:'FORCED_1_TO_3';root:MemberMatrixNode;shown:number;
 width:3;maximumLevel:5;maximumNodes:364;truncated:boolean;
 levels:{level:number;capacity:number;filled:number;complete:boolean;referenceAmountINR:number}[];
 rebirthEligibility:{level:4|5;count:number;eligible:boolean}[];
 canCredit:false;canPay:false;
};

@Injectable()
export class MatrixPlacementService{
 constructor(private readonly db:PrismaService){}
 enabled(){return process.env.MATRIX_PLACEMENT_ENABLED==='true'}
 private requireEnabled(){
  if(!this.enabled())throw new ServiceUnavailableException('Member matrix placement is not enabled');
 }
 async placeApprovedMember(tx:Prisma.TransactionClient,memberId:string){
  if(!this.enabled())return null;
  const current=await tx.matrixPosition.findUnique({where:{memberId}});
  if(current)return current;
  const locked=await tx.$queryRaw<Array<{nextSequence:number}>>`SELECT nextSequence FROM matrix_state WHERE id=1 FOR UPDATE`;
  if(locked.length!==1||!Number.isSafeInteger(locked[0].nextSequence)||locked[0].nextSequence<1)
   throw new ConflictException('Matrix sequence state unavailable');
  const sequence=locked[0].nextSequence;
  let parentId:string|null=null,slot=0;
  if(sequence>1){
   const parentSequence=Math.floor((sequence-2)/MATRIX_WIDTH)+1;
   slot=((sequence-2)%MATRIX_WIDTH)+1;
   const parent=await tx.matrixPosition.findUnique({where:{sequence:parentSequence},select:{id:true}});
   if(!parent)throw new ConflictException('Matrix parent unavailable');
   parentId=parent.id;
  }
  const position=await tx.matrixPosition.create({data:{
   id:randomUUID(),sequence,memberId,parentId,slot
  }});
  await tx.matrixState.update({where:{id:1},data:{nextSequence:{increment:1}}});
  await tx.memberAudit.create({data:{id:randomUUID(),memberId,action:'MATRIX_POSITION_ASSIGNED'}});
  return position;
 }
 async forMember(actor:MemberPrincipal){
  this.requireEnabled();
  if(actor.status!=='ACTIVE')throw new ForbiddenException('Only active members can view matrix placement');
  return this.read(actor.id,false);
 }
 async forStaff(memberId:string){
  this.requireEnabled();return this.read(memberId,true);
 }
 private async read(memberId:string,staff:boolean):Promise<MemberMatrixView>{
  const start=await this.db.matrixPosition.findUnique({where:{memberId},select:{
   id:true,sequence:true,slot:true,member:{select:{id:true,displayName:true,status:true}}
  }});
  if(!start)throw new NotFoundException('Matrix position not found');
  const root:MemberMatrixNode={positionId:start.id,memberId:start.member.id,
   label:staff?start.member.displayName:'You',status:start.member.status,
   sequence:start.sequence,slot:start.slot,level:0,children:[]};
  const nodes=new Map([[root.positionId,root]]);
  let frontier=[root.positionId],shown=1,truncated=false;
  const counts=[0,0,0,0,0];
  for(let level=1;level<=MATRIX_MAX_LEVEL&&frontier.length;level++){
   const remaining=MATRIX_MAX_NODES-shown;
   if(remaining<=0){truncated=true;break}
   const rows=await this.db.matrixPosition.findMany({
    where:{parentId:{in:frontier}},orderBy:{sequence:'asc'},take:remaining+1,
    select:{id:true,parentId:true,sequence:true,slot:true,
     member:{select:{id:true,displayName:true,status:true}}}
   });
   if(rows.length>remaining)truncated=true;
   const next:string[]=[];
   for(const row of rows.slice(0,remaining)){
    const parent=row.parentId?nodes.get(row.parentId):undefined;
    if(!parent)throw new ConflictException('Invalid matrix parent');
    const child:MemberMatrixNode={positionId:row.id,memberId:row.member.id,
     label:staff?row.member.displayName:'Member '+String(row.sequence).padStart(6,'0'),
     status:row.member.status,sequence:row.sequence,slot:row.slot,level,children:[]};
    parent.children.push(child);nodes.set(child.positionId,child);next.push(child.positionId);
    counts[level-1]++;shown++;
   }
   frontier=next;
   if(truncated)break;
  }
  const levels=counts.map((filled,index)=>({level:index+1,capacity:MATRIX_WIDTH**(index+1),
   filled,complete:filled===MATRIX_WIDTH**(index+1),referenceAmountINR:LEVEL_AMOUNTS[index]}));
  return {kind:'FORCED_1_TO_3',root,shown,width:3,maximumLevel:5,maximumNodes:364,truncated,
   levels,rebirthEligibility:[
    {level:4,count:1,eligible:levels[3].complete},
    {level:5,count:3,eligible:levels[4].complete}
   ],canCredit:false,canPay:false};
 }
}
