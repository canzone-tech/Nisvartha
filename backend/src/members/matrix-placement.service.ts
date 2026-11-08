import {ConflictException,ForbiddenException,Injectable,NotFoundException,ServiceUnavailableException} from '@nestjs/common';
import {MatrixPosition,Prisma} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {PrismaService} from '../database/prisma.service';
import {MemberPrincipal} from './member.dto';

export const MATRIX_WIDTH=3;
export const MATRIX_MAX_LEVEL=5;
export const MATRIX_MAX_NODES=364;
const LEVEL_AMOUNTS_PAISE=[250_000,500_000,1_000_000,5_000_000,9_000_000] as const;
const MAX_REBIRTHS_PER_ACTIVATION=128;

export type MemberMatrixNode={positionId:string;memberId:string;label:string;status:string;
 sequence:number;slot:number;level:number;kind:string;children:MemberMatrixNode[]};
export type MemberMatrixView={kind:'FORCED_1_TO_3';root:MemberMatrixNode;shown:number;
 width:3;maximumLevel:5;maximumNodes:364;truncated:boolean;
 levels:{level:number;capacity:number;filled:number;complete:boolean;referenceAmountINR:number}[];
 rebirthPositions:{sequence:number;sourceSequence:number|null;triggerLevel:number|null;ordinal:number|null;completedAt:Date|null}[];
 canCredit:boolean;canPay:false};

@Injectable()
export class MatrixPlacementService{
 constructor(private readonly db:PrismaService){}
 enabled(){return process.env.MATRIX_PLACEMENT_ENABLED==='true'}
 private compensationEnabled(){return process.env.MEMBER_COMPENSATION_ENABLED==='true'&&
  (process.env.NODE_ENV!=='production'||process.env.MEMBER_COMPENSATION_APPROVED==='true')}
 private requireEnabled(){if(!this.enabled())throw new ServiceUnavailableException('Member matrix placement is not enabled')}
 private async allocateOne(tx:Prisma.TransactionClient,memberId:string,entry:{
  entryKey:string;kind:'ORIGINAL'|'REBIRTH';sourcePositionId?:string;triggerLevel?:number;rebirthOrdinal?:number
 }){
  const found=await tx.matrixPosition.findUnique({where:{entryKey:entry.entryKey}});
  if(found)return found;
  const state=await tx.matrixState.findUniqueOrThrow({where:{id:1}});
  const sequence=state.nextSequence;
  let parentId:string|null=null,slot=0;
  if(sequence>1){
   const parentSequence=Math.floor((sequence-2)/MATRIX_WIDTH)+1;
   slot=((sequence-2)%MATRIX_WIDTH)+1;
   const parent=await tx.matrixPosition.findUnique({where:{sequence:parentSequence},select:{id:true}});
   if(!parent)throw new ConflictException('Matrix parent unavailable');
   parentId=parent.id;
  }
  const position=await tx.matrixPosition.create({data:{id:randomUUID(),sequence,
   entryKey:entry.entryKey,memberId,parentId,slot,kind:entry.kind,
   sourcePositionId:entry.sourcePositionId??null,triggerLevel:entry.triggerLevel??null,
   rebirthOrdinal:entry.rebirthOrdinal??null}});
  await tx.matrixState.update({where:{id:1},data:{nextSequence:{increment:1}}});
  await tx.memberAudit.create({data:{id:randomUUID(),memberId,
   action:entry.kind==='ORIGINAL'?'MATRIX_POSITION_ASSIGNED':'REBIRTH_POSITION_ASSIGNED'}});
  return position;
 }
 private levelRange(sequence:number,depth:number){
  let first=sequence,last=sequence;
  for(let i=0;i<depth;i++){first=MATRIX_WIDTH*(first-1)+2;last=MATRIX_WIDTH*(last-1)+4}
  return {first,last};
 }
 private async processCompletions(tx:Prisma.TransactionClient,initial:MatrixPosition){
  const queue=[initial];let generated=0;
  while(queue.length){
   const placed=queue.shift()!;
   let ancestorId=placed.parentId;
   for(let depth=1;ancestorId&&depth<=MATRIX_MAX_LEVEL;depth++){
    const ancestor=await tx.matrixPosition.findUniqueOrThrow({where:{id:ancestorId}});
    const range=this.levelRange(ancestor.sequence,depth);
    const filled=await tx.matrixPosition.count({where:{sequence:{gte:range.first,lte:range.last}}});
    if(filled===MATRIX_WIDTH**depth&&this.compensationEnabled()){
     const amountPaise=LEVEL_AMOUNTS_PAISE[depth-1];
     await tx.memberEarning.upsert({where:{earningKey:`MATRIX:${ancestor.id}:L${depth}`},create:{
      id:randomUUID(),earningKey:`MATRIX:${ancestor.id}:L${depth}`,
      kind:(`MATRIX_LEVEL_${depth}`) as any,level:depth,
      beneficiaryMemberId:ancestor.memberId,sourcePositionId:ancestor.id,amountPaise
     },update:{}});
     const rebirthCount=depth===4?1:depth===5?3:0;
     for(let ordinal=1;ordinal<=rebirthCount;ordinal++){
      const key=`REBIRTH:${ancestor.id}:L${depth}:${ordinal}`;
      if(await tx.matrixPosition.findUnique({where:{entryKey:key}}))continue;
      if(++generated>MAX_REBIRTHS_PER_ACTIVATION)throw new ConflictException('Rebirth cascade exceeded safety limit');
      const rebirth=await this.allocateOne(tx,ancestor.memberId,{entryKey:key,kind:'REBIRTH',
       sourcePositionId:ancestor.id,triggerLevel:depth,rebirthOrdinal:ordinal});
      queue.push(rebirth);
     }
     if(depth===5&&!ancestor.completedAt)
      await tx.matrixPosition.update({where:{id:ancestor.id},data:{completedAt:new Date()}});
    }
    ancestorId=ancestor.parentId;
   }
  }
 }
 async placeApprovedMember(tx:Prisma.TransactionClient,memberId:string){
  if(!this.enabled())return null;
  const key='ORIGINAL:'+memberId;
  const current=await tx.matrixPosition.findUnique({where:{entryKey:key}});
  if(current)return current;
  const locked=await tx.$queryRaw<Array<{nextSequence:number}>>`SELECT nextSequence FROM matrix_state WHERE id=1 FOR UPDATE`;
  if(locked.length!==1||!Number.isSafeInteger(locked[0].nextSequence)||locked[0].nextSequence<1)
   throw new ConflictException('Matrix sequence state unavailable');
  const position=await this.allocateOne(tx,memberId,{entryKey:key,kind:'ORIGINAL'});
  await this.processCompletions(tx,position);
  return position;
 }
 async forMember(actor:MemberPrincipal){this.requireEnabled();
  if(actor.status!=='ACTIVE')throw new ForbiddenException('Only active members can view matrix placement');
  return this.read(actor.id,false)}
 async forStaff(memberId:string){this.requireEnabled();return this.read(memberId,true)}
 private async read(memberId:string,staff:boolean):Promise<MemberMatrixView>{
  const start=await this.db.matrixPosition.findFirst({where:{memberId,kind:'ORIGINAL'},select:{
   id:true,sequence:true,slot:true,kind:true,member:{select:{id:true,displayName:true,status:true}}}});
  if(!start)throw new NotFoundException('Matrix position not found');
  const root:MemberMatrixNode={positionId:start.id,memberId:start.member.id,
   label:staff?start.member.displayName:'You',status:start.member.status,
   sequence:start.sequence,slot:start.slot,kind:start.kind,level:0,children:[]};
  const nodes=new Map([[root.positionId,root]]);let frontier=[root.positionId],shown=1,truncated=false;
  const counts=[0,0,0,0,0];
  for(let level=1;level<=MATRIX_MAX_LEVEL&&frontier.length;level++){
   const remaining=MATRIX_MAX_NODES-shown;if(remaining<=0){truncated=true;break}
   const rows=await this.db.matrixPosition.findMany({where:{parentId:{in:frontier}},
    orderBy:{sequence:'asc'},take:remaining+1,select:{id:true,parentId:true,sequence:true,slot:true,kind:true,
     member:{select:{id:true,displayName:true,status:true}}}});
   if(rows.length>remaining)truncated=true;const next:string[]=[];
   for(const row of rows.slice(0,remaining)){
    const parent=row.parentId?nodes.get(row.parentId):undefined;if(!parent)throw new ConflictException('Invalid matrix parent');
    const child:MemberMatrixNode={positionId:row.id,memberId:row.member.id,
     label:staff?row.member.displayName:'Member '+String(row.sequence).padStart(6,'0'),
     status:row.member.status,sequence:row.sequence,slot:row.slot,kind:row.kind,level,children:[]};
    parent.children.push(child);nodes.set(child.positionId,child);next.push(child.positionId);counts[level-1]++;shown++;
   }
   frontier=next;if(truncated)break;
  }
  const levels=counts.map((filled,index)=>({level:index+1,capacity:MATRIX_WIDTH**(index+1),
   filled,complete:filled===MATRIX_WIDTH**(index+1),referenceAmountINR:LEVEL_AMOUNTS_PAISE[index]/100}));
  const rebirth=await this.db.matrixPosition.findMany({where:{memberId,kind:'REBIRTH'},
   orderBy:{sequence:'asc'},take:100,select:{sequence:true,triggerLevel:true,rebirthOrdinal:true,
    completedAt:true,sourcePosition:{select:{sequence:true}}}});
  return {kind:'FORCED_1_TO_3',root,shown,width:3,maximumLevel:5,maximumNodes:364,truncated,levels,
   rebirthPositions:rebirth.map(x=>({sequence:x.sequence,sourceSequence:x.sourcePosition?.sequence??null,
    triggerLevel:x.triggerLevel,ordinal:x.rebirthOrdinal,completedAt:x.completedAt})),
   canCredit:this.compensationEnabled(),canPay:false};
 }
}
