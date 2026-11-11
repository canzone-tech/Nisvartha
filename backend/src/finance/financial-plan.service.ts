import {BadRequestException,ConflictException,Injectable,NotFoundException} from '@nestjs/common';
import {Prisma,FinancialPlanVersion,FinancialPlanState} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {PrismaService} from '../database/prisma.service';
import {StaffPrincipal} from '../staff/staff.dto';
import {PublishFinancialPlanDto} from './financial-plan.dto';

type Tx=Prisma.TransactionClient;
export const FINANCIAL_PLAN_VERSION_1=1;
export const FINANCIAL_PLAN_LEVELS=5;
export const FINANCIAL_PLAN_WIDTH=3;
const FIELDS=['joiningAmountPaise','directReferralPaise','level1Paise','level2Paise',
 'level3Paise','level4Paise','level5Paise','rebirthAtLevel4','rebirthAtLevel5'] as const;
type Field=typeof FIELDS[number];

export function checkFinancialPlan(input:Pick<PublishFinancialPlanDto,Field>):string[]{
 const issues:string[]=[];
 for(const key of FIELDS)
  if(!Number.isSafeInteger(input[key])||input[key]<0)
   issues.push('Invalid '+key);
 if(input.joiningAmountPaise<10000||input.joiningAmountPaise>40_000_000)
  issues.push('Joining amount outside supported receipt range');
 if(input.directReferralPaise>input.joiningAmountPaise)
  issues.push('Direct reward cannot exceed one verified joining receipt');
 for(const level of [1,2,3,4,5] as const)
  if(input[`level${level}Paise`]>200_000_000)
   issues.push('Level payout outside supported ledger range');
 if(input.rebirthAtLevel4>8||input.rebirthAtLevel5>8)
  issues.push('Rebirth fanout outside transactional budget');
 if(input.rebirthAtLevel4+input.rebirthAtLevel5>12)
  issues.push('Rebirth fanout exceeds per-position safety limit');
 // Payable amounts may not exceed all five levels' gross source receipts
 // even before referral liabilities. Global credit guard handles liquidity.
 const maxGross=363*input.joiningAmountPaise;
 const maxPayout=[1,2,3,4,5].reduce((sum,level)=>sum+
  input[`level${level}Paise` as Field],0);
 if(maxPayout+363*input.directReferralPaise>maxGross)
  issues.push('Potential plan obligations exceed the 363-position fee pool');
 return issues;
}

/** Authoritative MySQL plan, immutable revisions, serialized Admin activation. */
@Injectable()
export class FinancialPlanService {
 constructor(private readonly db:PrismaService){}
 async current(tx:Tx=this.db,lock=false):Promise<FinancialPlanVersion>{
  if(lock)await tx.$queryRaw`SELECT id FROM financial_plan_state WHERE id=1 FOR UPDATE`;
  const state=await tx.financialPlanState.findUnique({where:{id:1}});
  if(!state)throw new ConflictException('Financial plan is not initialized');
  const plan=await tx.financialPlanVersion.findUnique({where:{id:state.currentVersionId}});
  if(!plan)throw new ConflictException('Active financial plan reference invalid');
  return plan;
 }
 async versionForMember(tx:Tx,memberId:string):Promise<FinancialPlanVersion>{
  const account=await tx.memberAccount.findUnique({where:{id:memberId},
   select:{financialPlanVersionId:true}});
  if(!account)throw new NotFoundException('Member not found');
  const id=account.financialPlanVersionId??FINANCIAL_PLAN_VERSION_1;
  const plan=await tx.financialPlanVersion.findUnique({where:{id}});
  if(!plan)throw new ConflictException('Member plan version is missing');
  return plan;
 }
 async versionById(tx:Tx,id:number|null|undefined):Promise<FinancialPlanVersion>{
  const plan=await tx.financialPlanVersion.findUnique({where:{
   id:id??FINANCIAL_PLAN_VERSION_1}});
  if(!plan)throw new ConflictException('Financial plan version unavailable');
  return plan;
 }
 async list(){
  const [active,versions]=await this.db.$transaction([
   this.db.financialPlanState.findUnique({where:{id:1}}),
   this.db.financialPlanVersion.findMany({orderBy:{id:'desc'},take:50,
    include:{createdBy:{select:{email:true}}}})
  ]);
  if(!active)throw new ConflictException('Financial plan not initialized');
  return {activeVersionId:active.currentVersionId,revision:active.revision,
   matrixWidth:FINANCIAL_PLAN_WIDTH,maximumLevel:FINANCIAL_PLAN_LEVELS,
   versions};
 }
 async publish(input:PublishFinancialPlanDto,actor:StaffPrincipal){
  const problems=checkFinancialPlan(input);
  if(problems.length)throw new BadRequestException(problems);
  const requested=Object.fromEntries(FIELDS.map(name=>[name,input[name]])) as
   Pick<PublishFinancialPlanDto,Field>;
  try{
   return await this.db.$transaction(async tx=>{
    const rows=await tx.$queryRaw<Array<{id:number;currentVersionId:number;revision:number}>>`
     SELECT id,currentVersionId,revision FROM financial_plan_state WHERE id=1 FOR UPDATE`;
    if(rows.length!==1)throw new ConflictException('Financial plan pointer missing');
    const existing=await tx.financialPlanVersion.findUnique({where:{requestKey:input.requestKey}});
    if(existing){
     const matches=existing.createdById===actor.id&&
      existing.reason===input.reason.trim()&&FIELDS.every(key=>existing[key]===requested[key]);
     if(!matches)throw new ConflictException('Request key reused for different plan');
     return {id:existing.id,alreadyPublished:true,current:rows[0].currentVersionId===existing.id};
    }
    if(rows[0].currentVersionId!==input.expectedVersionId)
     throw new ConflictException('Active plan changed: reload before publishing');
    const old=await tx.financialPlanVersion.findUniqueOrThrow({where:{id:rows[0].currentVersionId}});
    if(FIELDS.every(key=>old[key]===requested[key]))
     throw new BadRequestException('No rule change; publishing duplicate financial policy is prohibited');
    const version=await tx.financialPlanVersion.create({data:{
     requestKey:input.requestKey,reason:input.reason.trim(),...requested,createdById:actor.id
    }});
    await tx.financialPlanState.update({where:{id:1},data:{
     currentVersionId:version.id,revision:{increment:1}
    }});
    await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,
     action:'FINANCIAL_PLAN_PUBLISHED',objectType:'FINANCIAL_PLAN_VERSION',
     objectId:String(version.id),
     summary:'Immutable policy version '+version.id+' activated; previous version '+old.id+
      ' retained for historical member and receipt snapshots'}});
    return {id:version.id,alreadyPublished:false,current:true};
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }catch(error){
   if(['P2002','P2034'].includes((error as {code?:string}).code??''))
    throw new ConflictException('Concurrent financial plan publish: reload and retry');
   throw error;
  }
 }

 /** Every new entitlement requires a unique earning key, actual verified
  * intake and globally serialized funding capacity. No cash movement occurs.
  */
 async credit(tx:Tx,input:Prisma.MemberEarningUncheckedCreateInput){
  if(!Number.isSafeInteger(input.amountPaise)||input.amountPaise<0)
   throw new ConflictException('Invalid financial entitlement');
  const prior=await tx.memberEarning.findUnique({where:{earningKey:input.earningKey}});
  if(prior)return prior;
  await tx.$queryRaw`SELECT id FROM financial_plan_state WHERE id=1 FOR UPDATE`;
  const [paid,offline,credited,refunds]=await Promise.all([
   tx.registrationPinPaidBatch.aggregate({_sum:{verifiedAmountPaise:true}}),
   tx.memberOfflineSale.aggregate({_sum:{amountPaise:true}}),
   tx.memberEarning.aggregate({_sum:{amountPaise:true}}),
   tx.$queryRaw<Array<{total:string|number}>>`
    SELECT COALESCE(SUM(receipt.unitAmountPaise),0) AS total
    FROM registration_pin_refunds refund
    JOIN registration_pins pin ON pin.id=refund.pinId
    JOIN registration_pin_paid_batches receipt ON receipt.batchId=pin.batchId`
  ]);
  const net=(paid._sum.verifiedAmountPaise??0)+(offline._sum.amountPaise??0)
   -Number(refunds[0]?.total??0);
  const obligated=credited._sum.amountPaise??0;
  if(!Number.isSafeInteger(net)||!Number.isSafeInteger(obligated)||
     net<obligated+input.amountPaise)
   throw new ConflictException('Verified receipt funding is insufficient for this earning');
  return tx.memberEarning.create({data:input});
 }
}
