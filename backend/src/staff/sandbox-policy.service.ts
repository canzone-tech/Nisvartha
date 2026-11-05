import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException,ServiceUnavailableException} from '@nestjs/common';
import {SandboxPolicyReviewStatus,StaffRole} from '@prisma/client';
import {isDisposableUatDatabase} from '../security/disposable-uat';
import {randomUUID} from 'node:crypto';
import {PrismaService} from '../database/prisma.service';
import {validateMatrixPreviewPolicy} from '../security/matrix-simulation';
import {StaffPrincipal} from './staff.dto';
import {SaveScenarioDto,ReviewScenarioDto} from './sandbox-policy.dto';

/**
 * Authenticated UAT-only immutable scenario versions.
 * 'REVIEWED' is editorial feedback, never approval to pay, place or issue IDs.
 */
@Injectable()
export class SandboxPolicyService{
 constructor(private readonly db:PrismaService){}
 private authorize(actor:StaffPrincipal){
  if(process.env.NISVARTHA_UAT_PLAN!=='synthetic'||!isDisposableUatDatabase())
   throw new ServiceUnavailableException('Sandbox scenario workflow cannot run outside disposable UAT');
  if(actor.role!==StaffRole.ADMIN)
   throw new ForbiddenException('Only administrators may perform scenario actions');
 }
 list(actor:StaffPrincipal){
  this.authorize(actor);
  return this.db.sandboxPolicyRevision.findMany({
   orderBy:{id:'desc'},take:50,
   select:{id:true,requestKey:true,entrants:true,rebirthAtLevel4:true,
    rebirthAtLevel5:true,rebirthLimit:true,rebirthEnabled:true,
    authorId:true,reviewerId:true,status:true,reason:true,
    createdAt:true,submittedAt:true,reviewedAt:true}
  });
 }
 async save(input:SaveScenarioDto,actor:StaffPrincipal){
  this.authorize(actor);
  const {requestKey,...policy}=input;
  let checked;
  try{checked=validateMatrixPreviewPolicy(policy);}
  catch(e){
   if(e instanceof TypeError||e instanceof RangeError)
    throw new BadRequestException(e.message);
   throw e;
  }
  // Immutable row content + unique UUID form stable idempotency at DB level.
  // No other record is created if retry reuses an existing requestKey.
  try{
   return await this.db.$transaction(async tx=>{
    const saved=await tx.sandboxPolicyRevision.create({
     data:{requestKey,...checked,authorId:actor.id}
    });
    await tx.cmsAudit.create({data:{
     id:randomUUID(),actorId:actor.id,action:'SANDBOX_POLICY_SAVED',
     objectType:'SANDBOX_POLICY',objectId:String(saved.id),
     summary:'Created nonfinancial matrix scenario revision '+saved.id
    }});
    return saved;
   });
  }catch(error){
   if((error as {code?:string}).code!=='P2002')throw error;
   const prior=await this.db.sandboxPolicyRevision.findUnique({where:{requestKey}});
   if(prior&&prior.authorId===actor.id&&
    (Object.keys(checked) as (keyof typeof checked)[])
     .every(k=>prior[k]===checked[k]))
    return prior; // Same operation already committed.
   throw new ConflictException('Request key already used for a different policy');
  }
 }
 async submit(id:number,actor:StaffPrincipal){
  this.authorize(actor);
  return this.db.$transaction(async tx=>{
   const policy=await tx.sandboxPolicyRevision.findUnique({where:{id}});
   if(!policy)throw new NotFoundException('Sandbox scenario not found');
   if(policy.authorId!==actor.id)throw new ForbiddenException('Only author may submit their draft');
   const updated=await tx.sandboxPolicyRevision.updateMany({
    where:{id,status:SandboxPolicyReviewStatus.DRAFT},
    data:{status:SandboxPolicyReviewStatus.SUBMITTED,submittedAt:new Date()}
   });
   if(updated.count!==1)throw new ConflictException('Scenario is no longer a draft');
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,
    action:'SANDBOX_POLICY_SUBMITTED',objectType:'SANDBOX_POLICY',
    objectId:String(id),summary:'Scenario sent for independent review; not active'}});
   return {id,status:SandboxPolicyReviewStatus.SUBMITTED};
  });
 }
 async review(id:number,input:ReviewScenarioDto,actor:StaffPrincipal){
  this.authorize(actor);
  const reason=input.reason.trim();
  if(reason.length<8)throw new BadRequestException('Review reason must contain at least 8 characters');
  return this.db.$transaction(async tx=>{
   const policy=await tx.sandboxPolicyRevision.findUnique({where:{id}});
   if(!policy)throw new NotFoundException('Sandbox scenario not found');
   if(policy.authorId===actor.id)
    throw new ForbiddenException('Author cannot review own scenario');
   const updated=await tx.sandboxPolicyRevision.updateMany({
    where:{id,status:SandboxPolicyReviewStatus.SUBMITTED,reviewerId:null},
    data:{status:input.decision,reviewerId:actor.id,reason,reviewedAt:new Date()}
   });
   if(updated.count!==1)throw new ConflictException('Scenario already reviewed or not submitted');
   await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,
    action:'SANDBOX_POLICY_'+input.decision,objectType:'SANDBOX_POLICY',
    objectId:String(id),summary:'Independent review of non-operational scenario '+id
     +' ('+input.decision+'); no financial activation'}});
   return {id,status:input.decision,active:false,canCredit:false,canIssueRebirth:false};
  });
 }
}
