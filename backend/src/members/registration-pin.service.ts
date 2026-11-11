import {BadRequestException,ConflictException,Injectable,ServiceUnavailableException} from '@nestjs/common';
import {FinancialSettlementKind,Prisma} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {sealRegistrationCode,unsealRegistrationCode} from '../security/pin-vault';
import {PrismaService} from '../database/prisma.service';
import {StaffPrincipal} from '../staff/staff.dto';
import {generateOpaqueCredential} from '../security/opaque-credential';
import {validateEpinBatchRequest} from '../security/epin-batch';
import {RegistrationPinBatchDto,RegistrationPinCancelDto,RegistrationPinListDto,RegistrationPinRefundDto,RegistrationPinReplaceDto,VerifiedPaidPinBatchDto} from './member.dto';
import {assertRegistrationPinEnvironment,registrationPinHash} from './registration-pin-policy';
import {FinancialPlanService} from '../finance/financial-plan.service';

@Injectable()
export class RegistrationPinService{
 constructor(private readonly db:PrismaService,private readonly plans:FinancialPlanService){}
 /** Financial issuance is a separate, default-OFF deployment decision.
  * A technical build or owner confirmation does not grant release approval.
  */
 private paidIssuanceEnabled(){
  return process.env.PAID_PIN_ISSUANCE_ENABLED==='true'&&
   process.env.PAID_PIN_ACCOUNTING_APPROVED==='true';
 }
 /** Verified batch creation is atomic with evidence and reference registry. */
 async createVerifiedPaid(input:VerifiedPaidPinBatchDto,actor:StaffPrincipal){
  assertRegistrationPinEnvironment();
  if(!this.paidIssuanceEnabled())
   throw new ServiceUnavailableException('Verified paid E-PIN issuance is not approved in this environment');
  if(input.paymentVerified!==true)
   throw new BadRequestException('Admin must verify receipt of the offline paid amount');
  if(input.expiresAt!==undefined)
   throw new BadRequestException('New paid E-PINs do not expire');
  const plan=await this.plans.current();
  if(!Number.isSafeInteger(input.quantity)||input.quantity<1||input.quantity>50||
     input.verifiedAmountPaise!==input.quantity*plan.joiningAmountPaise)
   throw new BadRequestException('Verified amount must match current financial plan and PIN quantity');
  const receivedAt=new Date(input.receivedAt);
  if(!Number.isFinite(receivedAt.getTime())||receivedAt>new Date())
   throw new BadRequestException('Offline paid amount must already be received');
  return this.create(input,actor,input);
 }
 /** Read-only accounting includes only batches with explicit new verified receipts.
  * Cancelled-but-not-refunded PINs still count in received net amount.
  */
 async paidSummary(){
  assertRegistrationPinEnvironment();
  const paid:Prisma.RegistrationPinWhereInput={batch:{paidReceipt:{isNot:null}}};
  const [verified,used,cancelledPending,refunded,available,allocations,
   invalidAllocations,externalDuplicateSales,totalPins,allocated,refundedMoney,pendingMoney,
   invalidReceiptRows]=await this.db.$transaction([
   this.db.registrationPinPaidBatch.aggregate({_sum:{verifiedAmountPaise:true},_count:{_all:true}}),
   this.db.registrationPin.count({where:{...paid,redeemedAt:{not:null}}}),
   this.db.registrationPin.count({where:{...paid,cancelledAt:{not:null},refund:{is:null},replacedBy:{is:null}}}),
   this.db.registrationPin.count({where:{...paid,refund:{isNot:null}}}),
   this.db.registrationPin.count({where:{...paid,redeemedAt:null,cancelledAt:null,
    OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}]}}),
   this.db.registrationPinPaidRedemption.count(),
   this.db.registrationPinPaidRedemption.count({where:{pin:{batch:{paidReceipt:{is:null}}}}}),
   this.db.memberOfflineSale.count({where:{registrationPin:{batch:{paidReceipt:{isNot:null}}}}}),
   this.db.registrationPinBatch.aggregate({where:{paidReceipt:{isNot:null}},_sum:{quantity:true}}),
   this.db.registrationPinPaidRedemption.aggregate({_sum:{amountPaise:true}}),
   this.db.$queryRaw<Array<{total:Prisma.Decimal}>>`
    SELECT COALESCE(SUM(receipt.unitAmountPaise),0) AS total
    FROM registration_pin_refunds refund
    JOIN registration_pins pin ON pin.id=refund.pinId
    JOIN registration_pin_paid_batches receipt ON receipt.batchId=pin.batchId`,
   this.db.$queryRaw<Array<{total:Prisma.Decimal}>>`
    SELECT COALESCE(SUM(receipt.unitAmountPaise),0) AS total
    FROM registration_pins pin
    JOIN registration_pin_paid_batches receipt ON receipt.batchId=pin.batchId
    LEFT JOIN registration_pin_refunds refund ON refund.pinId=pin.id
    LEFT JOIN registration_pin_replacements replacement ON replacement.oldPinId=pin.id
    WHERE pin.cancelledAt IS NOT NULL AND refund.id IS NULL
      AND replacement.oldPinId IS NULL`,
   this.db.$queryRaw<Array<{invalid:bigint}>>`
    SELECT COUNT(*) AS invalid FROM registration_pin_paid_batches receipt
    JOIN registration_pin_batches batch ON batch.id=receipt.batchId
    WHERE receipt.verifiedAmountPaise <> (batch.quantity * receipt.unitAmountPaise)`
  ],{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  const grossPaidPaise=verified._sum.verifiedAmountPaise??0;
  const paidPinCount=totalPins._sum.quantity??0;
  const refundedPaise=Number(refundedMoney[0]?.total??0);
  const refundPendingPaise=Number(pendingMoney[0]?.total??0);
  const allocatedRegistrationPaise=allocated._sum.amountPaise??0;
  if(![grossPaidPaise,paidPinCount,refundedPaise,refundPendingPaise,
   allocatedRegistrationPaise].every(n=>Number.isSafeInteger(n)&&n>=0))
   throw new ConflictException('Verified paid receipt totals require reconciliation');
  const receiptAmountMismatch=Number(invalidReceiptRows[0]?.invalid??0)>0;
  const reconciliationIssues={
   unmatchedPaidRedemptions:Math.max(0,used-allocations),
   extraPaidAllocations:Math.max(0,allocations-used),
   duplicateRegistrationSaleRecords:externalDuplicateSales,
   legacyAllocationsWithoutPaidReceipt:invalidAllocations,
   refundExceedsReceipts:refunded>paidPinCount||refundedPaise>grossPaidPaise,
   receiptAmountMismatch
  };
  const current=await this.plans.current();
  return {currency:'INR' as const,unitAmountPaise:current.joiningAmountPaise,
   verifiedBatchCount:verified._count._all,paidPinCount,
   usedPaidPinCount:used,availablePaidPinCount:available,
   verifiedMemberAllocations:allocations,allocatedRegistrationPaise,
   reconciliationIssues,reconciliationOk:!Object.values(reconciliationIssues).some(value=>Boolean(value)),
   cancelledRefundPendingCount:cancelledPending,refundedPinCount:refunded,
   grossPaidPaise,refundPendingPaise,refundedPaise,
   netReceivedAfterRefundPaise:grossPaidPaise-refundedPaise};
 }

 /** Admin-only re-display of encrypted registration codes; each plaintext read is audited. */
 async list(input:RegistrationPinListDto,actor:StaffPrincipal){
  assertRegistrationPinEnvironment();
  const now=new Date();
  const status=input.status??'ALL';
  const availableWhere:Prisma.RegistrationPinWhereInput={
   redeemedAt:null,cancelledAt:null,OR:[{expiresAt:null},{expiresAt:{gt:now}}]
  };
  const statusWhere:Prisma.RegistrationPinWhereInput=
   status==='USED'?{redeemedAt:{not:null}}:
   status==='EXPIRED'?{redeemedAt:null,cancelledAt:null,expiresAt:{lte:now}}:
   status==='CANCELLED'?{cancelledAt:{not:null},refund:{is:null},replacedBy:{is:null}}:
   status==='REPLACED'?{replacedBy:{isNot:null}}:
   status==='REFUNDED'?{refund:{isNot:null}}:
   status==='AVAILABLE'?availableWhere:{};
  const accounting=input.accounting??'ALL';
  const where:Prisma.RegistrationPinWhereInput={...statusWhere,
   ...(accounting==='VERIFIED_PAID'?{batch:{paidReceipt:{isNot:null}}}:
      accounting==='LEGACY'?{batch:{paidReceipt:{is:null}}}:{})};
  if(input.cursor){
   const found=await this.db.registrationPin.findFirst({where:{id:input.cursor,...where},select:{id:true}});
   if(!found)throw new BadRequestException('Invalid registration PIN cursor');
  }
  const [rows,total,matchingTotal,available,used,expired,cancelled,refunded,replaced]=await Promise.all([
   this.db.registrationPin.findMany({
    where,orderBy:[{createdAt:'desc'},{id:'desc'}],take:51,
    ...(input.cursor?{cursor:{id:input.cursor},skip:1}:{}),
    select:{id:true,batchId:true,displaySuffix:true,sealedCode:true,expiresAt:true,redeemedAt:true,
     redeemedByMemberId:true,createdAt:true,cancelledAt:true,cancellationReason:true,
     refund:{select:{bankReference:true,evidenceRef:true,paidAt:true,recordedAt:true}},
     replacedBy:{select:{newPinId:true}},replaces:{select:{oldPinId:true}},
     batch:{select:{quantity:true,createdAt:true,
      paidReceipt:{select:{unitAmountPaise:true,verifiedAmountPaise:true,bankReference:true}}}}}
   }),
   this.db.registrationPin.count(),
   this.db.registrationPin.count({where}),
   this.db.registrationPin.count({where:availableWhere}),
   this.db.registrationPin.count({where:{redeemedAt:{not:null}}}),
   this.db.registrationPin.count({where:{redeemedAt:null,cancelledAt:null,expiresAt:{lte:now}}}),
   this.db.registrationPin.count({where:{cancelledAt:{not:null},refund:{is:null},replacedBy:{is:null}}}),
   this.db.registrationPin.count({where:{refund:{isNot:null}}}),
   this.db.registrationPin.count({where:{replacedBy:{isNot:null}}})
  ]);
  const page=rows.slice(0,50);
  // Decrypt first; an invalid/missing key must never be recorded as a successful reveal.
  const items=page.map(pin=>({
    id:pin.id,batchId:pin.batchId,displaySuffix:pin.displaySuffix,
    code:pin.sealedCode?unsealRegistrationCode('registration-access',pin.id,pin.sealedCode):null,
    expiresAt:pin.expiresAt,createdAt:pin.createdAt,cancelledAt:pin.cancelledAt,
    cancellationReason:pin.cancellationReason,refund:pin.refund,
    replacementPinId:pin.replacedBy?.newPinId??null,
    replacesPinId:pin.replaces?.oldPinId??null,
    redeemedAt:pin.redeemedAt,redeemedByMemberId:pin.redeemedByMemberId,
    batchQuantity:pin.batch.quantity,batchCreatedAt:pin.batch.createdAt,
    accounting:pin.batch.paidReceipt?'VERIFIED_PAID':'LEGACY',
    unitAmountPaise:pin.batch.paidReceipt?.unitAmountPaise??null,
    paidBankReference:pin.batch.paidReceipt?.bankReference??null,
    status:pin.refund?'REFUNDED':pin.replacedBy?'REPLACED':pin.cancelledAt?'CANCELLED':pin.redeemedAt?'USED':
     pin.expiresAt!==null&&pin.expiresAt<=now?'EXPIRED':'AVAILABLE'
   }));
  const displayed=items.filter(pin=>pin.code!==null).length;
  // Never return credentials if the audit write fails.
  if(displayed)await this.db.cmsAudit.create({data:{
   id:randomUUID(),actorId:actor.id,action:'REGISTRATION_PINS_VIEWED',
   objectType:'REGISTRATION_PIN_INVENTORY',objectId:actor.id,
   summary:'Admin retrieved '+displayed+' encrypted registration codes'
  }});
  return {classification:'REGISTRATION_ACCESS' as const,
   total,matchingTotal,counts:{available,used,expired,cancelled,refunded,replaced},status,accounting,
   items,nextCursor:rows.length>50?page[page.length-1].id:null};
 }


 /** Cancellation is a one-way lock-serialized revocation of an UNUSED PIN.
  * It does not create bank evidence, a completed refund, or payable liability.
  */
 async cancel(pinId:string,input:RegistrationPinCancelDto,actor:StaffPrincipal){
  assertRegistrationPinEnvironment();
  const reason=input.reason.trim();
  if(reason.length<8)throw new BadRequestException('Cancellation reason is required');
  try{
   return await this.db.$transaction(async tx=>{
    const locked=await tx.$queryRaw<Array<{id:string}>>`
     SELECT id FROM registration_pins WHERE id=${pinId} FOR UPDATE`;
    if(locked.length!==1)throw new BadRequestException('Registration PIN not found');
    const pin=await tx.registrationPin.findUniqueOrThrow({where:{id:pinId},
     include:{refund:{select:{id:true}}}});
    if(pin.cancelledAt){
     if(pin.cancelRequestKey===input.requestKey&&pin.cancellationReason===reason)
      return {id:pinId,status:pin.refund?'REFUNDED' as const:'CANCELLED' as const,
       refundPending:!pin.refund};
     throw new ConflictException('PIN is already cancelled; use the original request reference');
    }
    if(pin.redeemedAt||pin.redeemedByMemberId)
     throw new ConflictException('Used PIN cannot be cancelled');
    await tx.registrationPin.update({where:{id:pinId},data:{
     cancelledAt:new Date(),cancelledById:actor.id,
     cancellationReason:reason,cancelRequestKey:input.requestKey
    }});
    await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,
     action:'REGISTRATION_PIN_CANCELLED',objectType:'REGISTRATION_PIN',
     objectId:pinId,summary:'Unused PIN revoked; offline refund not yet confirmed'}});
    return {id:pinId,status:'CANCELLED' as const,refundPending:true};
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }catch(error){
   if(['P2002','P2034'].includes((error as {code?:string}).code??''))
    throw new ConflictException('PIN cancellation changed; refresh and retry');
   throw error;
  }
 }
 /** Admin attests the bank transfer was ALREADY completed offline.
  * A refund record never initiates a transfer and never auto-follows cancel.
  */
 async confirmRefund(pinId:string,input:RegistrationPinRefundDto,actor:StaffPrincipal){
  assertRegistrationPinEnvironment();
  const paidAt=new Date(input.paidAt);
  const reference=input.bankReference.trim().toUpperCase();
  const evidence=input.evidenceRef.trim().toUpperCase();
  if(!Number.isFinite(paidAt.valueOf())||paidAt>new Date())
   throw new BadRequestException('Refund paid time must be a completed past transaction');
  try{
   return await this.db.$transaction(async tx=>{
    const locked=await tx.$queryRaw<Array<{id:string}>>`
     SELECT id FROM registration_pins WHERE id=${pinId} FOR UPDATE`;
    if(locked.length!==1)throw new BadRequestException('Registration PIN not found');
    const pin=await tx.registrationPin.findUniqueOrThrow({where:{id:pinId},
     include:{refund:true,replacedBy:true}});
    if(pin.replacedBy)throw new ConflictException('Replaced PIN cannot be refunded; use its terminal successor');
    if(!pin.cancelledAt||pin.redeemedAt||pin.redeemedByMemberId)
     throw new ConflictException('Only a cancelled unused PIN may have an offline refund');
    if(paidAt<pin.cancelledAt)
     throw new BadRequestException('Refund paid time cannot precede cancellation');
    if(pin.refund){
     if(pin.refund.requestKey===input.requestKey&&
        pin.refund.bankReference===reference&&
        pin.refund.evidenceRef===evidence&&
        pin.refund.paidAt.getTime()===paidAt.getTime())
      return {id:pinId,refundId:pin.refund.id,status:'REFUNDED' as const,
       bankReference:reference,paidAt:pin.refund.paidAt};
     throw new ConflictException('Refund already confirmed; duplicate transfer is not permitted');
    }
    const refundId=randomUUID();
    await tx.financialSettlementReference.create({data:{
     reference,sourceId:refundId,sourceKind:FinancialSettlementKind.PIN_REFUND
    }});
    await tx.registrationPinRefund.create({data:{
     id:refundId,pinId,requestKey:input.requestKey,
     bankReference:reference,evidenceRef:evidence,paidAt,recordedById:actor.id
    }});
    await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,
     action:'REGISTRATION_PIN_REFUND_CONFIRMED',objectType:'REGISTRATION_PIN',
     objectId:pinId,summary:'Admin recorded evidence for an externally completed PIN refund'}});
    return {id:pinId,refundId,status:'REFUNDED' as const,bankReference:reference,paidAt};
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }catch(error){
   if(['P2002','P2034'].includes((error as {code?:string}).code??''))
    throw new ConflictException('Refund reference already used or changed; refresh and retry');
   throw error;
  }
 }

 /** Q8-A: Paid E-PIN succession reuses its existing receipt, never minting money.
  * Row locking serializes replacement against an actual bank refund.
  */
 async replace(pinId:string,input:RegistrationPinReplaceDto,actor:StaffPrincipal){
  assertRegistrationPinEnvironment();
  if(!this.paidIssuanceEnabled())
   throw new ServiceUnavailableException('Paid E-PIN replacement is disabled');
  try{
   return await this.db.$transaction(async tx=>{
    const locked=await tx.$queryRaw<Array<{id:string}>>
     `SELECT id FROM registration_pins WHERE id=${pinId} FOR UPDATE`;
    if(locked.length!==1)throw new BadRequestException('Registration PIN not found');
    const original=await tx.registrationPin.findUniqueOrThrow({where:{id:pinId},
     include:{batch:{include:{paidReceipt:true}},refund:true,replacedBy:{include:{newPin:true}}}});
    if(!original.batch.paidReceipt)
     throw new ConflictException('Legacy E-PIN has no verified paid entitlement to replace');
    if(!original.cancelledAt||original.redeemedAt||original.redeemedByMemberId)
     throw new ConflictException('Only cancelled unused E-PINs can be replaced');
    if(original.refund)throw new ConflictException('Refunded E-PINs cannot be replaced');
    if(original.replacedBy){
     if(original.replacedBy.requestKey!==input.requestKey)
      throw new ConflictException('E-PIN already replaced');
     const pin=original.replacedBy.newPin;
     if(!pin.sealedCode)throw new ConflictException('Replacement code is unavailable');
     return {oldPinId:pinId,pinId:pin.id,
      code:unsealRegistrationCode('registration-access',pin.id,pin.sealedCode),
      alreadyIssued:true,paidAmountAddedPaise:0};
    }
    const id=randomUUID(),code=generateOpaqueCredential();
    await tx.registrationPin.create({data:{id,batchId:original.batchId,
     tokenHash:registrationPinHash(code),displaySuffix:code.slice(-6),
     sealedCode:sealRegistrationCode('registration-access',id,code),expiresAt:null}});
    await tx.registrationPinReplacement.create({data:{oldPinId:pinId,
     newPinId:id,requestKey:input.requestKey,issuedById:actor.id}});
    await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,
     action:'REGISTRATION_PIN_REPLACED',objectType:'REGISTRATION_PIN',objectId:pinId,
     summary:'Cancelled paid PIN replaced with linked successor; no additional payment'}});
    return {oldPinId:pinId,pinId:id,code,alreadyIssued:false,paidAmountAddedPaise:0};
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }catch(error){
   if(['P2002','P2034'].includes((error as {code?:string}).code??''))
    throw new ConflictException('Replacement request already used or changed; refresh and retry');
   throw error;
  }
 }
 async create(input:RegistrationPinBatchDto,actor:StaffPrincipal,verified?:VerifiedPaidPinBatchDto){
  assertRegistrationPinEnvironment();
  if(!verified&&this.paidIssuanceEnabled())
   throw new ConflictException('Use Admin-verified paid E-PIN issuance; unverified creation is disabled');
  if(!Number.isSafeInteger(input.quantity)||input.quantity<1||input.quantity>50)
   throw new BadRequestException('Batch quantity must be 1–50');
  // New operational PIN batches never expire. Legacy explicit expiry remains valid.
  let expiresAt:Date|null=null;
  if(input.expiresAt!==undefined){
   try{
    const validated=validateEpinBatchRequest({quantity:input.quantity,expiresAt:input.expiresAt});
    expiresAt=new Date(validated.expiresAt);
   }catch(err){
    if(err instanceof RangeError||err instanceof TypeError)
     throw new BadRequestException('Invalid registration PIN expiry');
    throw err;
   }
  }
  if(await this.db.registrationPinBatch.findUnique({
   where:{requestKey:input.requestKey},select:{id:true}
  }))throw new ConflictException('Batch already processed; codes can only be shown once');
  const batchId=randomUUID();
  const codes=Array.from({length:input.quantity},()=>generateOpaqueCredential());
  const rows=codes.map(code=>{
   const id=randomUUID();
   return {id,batchId,tokenHash:registrationPinHash(code),
    displaySuffix:code.slice(-6),sealedCode:sealRegistrationCode('registration-access',id,code),
    expiresAt};
  });
  try{
   await this.db.$transaction(async tx=>{
    await tx.registrationPinBatch.create({data:{id:batchId,requestKey:input.requestKey,
     issuerId:actor.id,quantity:input.quantity,expiresAt}});
    if(verified){
     const plan=await this.plans.current(tx,true);
     if(verified.verifiedAmountPaise!==input.quantity*plan.joiningAmountPaise)
      throw new ConflictException('Financial plan changed during paid PIN issuance; retry with new amount');
     const bankReference=verified.bankReference.trim().toUpperCase();
     await tx.financialSettlementReference.create({data:{
      reference:bankReference,sourceId:batchId,sourceKind:FinancialSettlementKind.PIN_PAYMENT
     }});
     await tx.registrationPinPaidBatch.create({data:{
      batchId,bankReference,evidenceRef:verified.evidenceRef.trim().toUpperCase(),
      receivedAt:new Date(verified.receivedAt),
      verifiedAmountPaise:verified.verifiedAmountPaise,
      unitAmountPaise:plan.joiningAmountPaise,financialPlanVersionId:plan.id,
      verifiedById:actor.id
     }});
    }
    await tx.registrationPin.createMany({data:rows});
    await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,
     action:verified?'VERIFIED_PAID_PINS_ISSUED':'REGISTRATION_ACCESS_PINS_CREATED',
     objectType:'REGISTRATION_PIN_BATCH',objectId:batchId,
     summary:verified?'Verified offline paid amount recorded for '+input.quantity+' PINs':
      'Registration E-PIN batch created: quantity '+input.quantity}});
   });
  }catch(err){
   if(['P2002','P2034'].includes((err as {code?:string}).code??''))
    throw new ConflictException('Batch request or bank reference already processed');
   throw err;
  }
  return {batchId,quantity:codes.length,expiresAt:expiresAt?.toISOString()??null,
   classification:'REGISTRATION_ACCESS',codes,
   accounting:verified?'VERIFIED_PAID':'LEGACY',
   verifiedAmountPaise:verified?.verifiedAmountPaise??null};
 }
}
