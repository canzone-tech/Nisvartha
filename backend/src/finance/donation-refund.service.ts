import {BadRequestException,ConflictException,Injectable,NotFoundException} from '@nestjs/common';
import {DonationRefundStatus,DonationRefundEventKind,Prisma} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {PrismaService} from '../database/prisma.service';
import {StaffPrincipal} from '../staff/staff.dto';
import {CreateDonationRefundDto,ReconcileDonationRefundDto} from './donation-refund.dto';

/** One-Admin, evidence-only standalone donation refunds, never recruitment payouts. */
@Injectable()
export class DonationRefundService {
 constructor(private readonly db:PrismaService){}
 private enabled(){
  if(process.env.DONATION_ACCOUNTING_ENABLED!=='true')
   throw new NotFoundException('Donation accounting disabled');
 }
 async list(receiptId:string,actor:StaffPrincipal){
  this.enabled();
  const [receipt,items]=await this.db.$transaction([
   this.db.donationReceipt.findUnique({where:{id:receiptId},
    select:{id:true,status:true,amountPaise:true}}),
   this.db.donationRefund.findMany({where:{receiptId},
    orderBy:[{createdAt:'asc'},{id:'asc'}],
    include:{events:{orderBy:{createdAt:'asc'},
     select:{kind:true,evidenceRef:true,createdAt:true}}}})
  ],{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  if(!receipt)throw new NotFoundException('Donation receipt not found');
  const reserved=items.filter(r=>r.status!=='REJECTED')
   .reduce((n,r)=>n+BigInt(r.amountPaise),0n);
  const confirmed=items.filter(r=>r.status==='CONFIRMED')
   .reduce((n,r)=>n+BigInt(r.amountPaise),0n);
  await this.db.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,
   action:'DONATION_REFUNDS_VIEWED',objectType:'DONATION',objectId:receiptId,
   summary:'ADMIN inspected standalone outgoing refund records'}});
  return {classification:'OFFLINE_REFUNDS_ONLY',receiptId,
   receiptStatus:receipt.status,amountPaise:receipt.amountPaise,
   reservedPaise:reserved.toString(),confirmedPaise:confirmed.toString(),
   availablePaise:receipt.status==='RECONCILED'
    ?(BigInt(receipt.amountPaise)-reserved).toString():'0',
   items};
 }
 async create(receiptId:string,input:CreateDonationRefundDto,actor:StaffPrincipal){
  this.enabled();
  const reference=input.bankReference.toUpperCase();
  const same=(r:{receiptId:string;bankReference:string;amountPaise:number;
    evidenceRef:string;createdById:string})=>
   r.receiptId===receiptId&&r.bankReference===reference&&
   r.amountPaise===input.amountPaise&&r.evidenceRef===input.evidenceRef&&
   r.createdById===actor.id;
  try{
   return await this.db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM donation_receipts WHERE id=${receiptId} FOR UPDATE`;
    const receipt=await tx.donationReceipt.findUnique({where:{id:receiptId}});
    if(!receipt)throw new NotFoundException('Donation receipt not found');
    const prior=await tx.donationRefund.findUnique({where:{requestKey:input.requestKey}});
    if(prior){
     if(same(prior))return prior;
     throw new ConflictException('Refund request key already used');
    }
    if(receipt.status!=='RECONCILED')
     throw new BadRequestException('Only reconciled donations can be refunded');
    const sums=await tx.donationRefund.aggregate({where:{
     receiptId,status:{in:['PENDING','CONFIRMED']}
    },_sum:{amountPaise:true}});
    const reserved=BigInt(sums._sum.amountPaise??0);
    if(reserved+BigInt(input.amountPaise)>BigInt(receipt.amountPaise))
     throw new ConflictException('Refund amount exceeds unreserved donation amount');
    const refund=await tx.donationRefund.create({data:{
     id:randomUUID(),receiptId,requestKey:input.requestKey,
     bankReference:reference,amountPaise:input.amountPaise,
     evidenceRef:input.evidenceRef,createdById:actor.id
    }});
    await tx.donationRefundEvent.create({data:{
     id:randomUUID(),refundId:refund.id,requestKey:input.requestKey,
     kind:'REQUESTED',actorId:actor.id,evidenceRef:input.evidenceRef
    }});
    await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,
     action:'DONATION_REFUND_PENDING',objectType:'DONATION',objectId:receiptId,
     summary:'Pending offline refund reserved; no cleared transfer asserted'}});
    return refund;
   },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
  }catch(err){
   const code=(err as {code?:string})?.code;
   if(code==='P2002'){
    const prior=await this.db.donationRefund.findUnique({where:{requestKey:input.requestKey}});
    if(prior&&same(prior))return prior;
    throw new ConflictException('Refund bank reference or request key exists');
   }
   if(code==='P2034')throw new ConflictException('Concurrent refund; retry with same key');
   throw err;
  }
 }
 async reconcile(receiptId:string,refundId:string,input:ReconcileDonationRefundDto,actor:StaffPrincipal){
  this.enabled();
  try{
   return await this.db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM donation_refunds WHERE id=${refundId} FOR UPDATE`;
    const refund=await tx.donationRefund.findUnique({where:{id:refundId}});
    if(!refund||refund.receiptId!==receiptId)
     throw new NotFoundException('Refund not found');
    if(refund.status!==DonationRefundStatus.PENDING){
     if(refund.reviewRequestKey===input.requestKey&&
      refund.reviewEvidenceRef===input.evidenceRef&&refund.status===input.status)
      return refund;
     throw new ConflictException('Refund already finalized');
    }
    const collision=await tx.donationRefund.findUnique({where:{reviewRequestKey:input.requestKey}});
    if(collision)throw new ConflictException('Review key already used');
    const updated=await tx.donationRefund.update({where:{id:refundId},data:{
     status:input.status,reviewRequestKey:input.requestKey,
     reviewEvidenceRef:input.evidenceRef,reviewedAt:new Date()
    }});
    await tx.donationRefundEvent.create({data:{
     id:randomUUID(),refundId,requestKey:input.requestKey,
     kind:input.status==='CONFIRMED'?DonationRefundEventKind.CONFIRMED:DonationRefundEventKind.REJECTED,
     actorId:actor.id,evidenceRef:input.evidenceRef
    }});
    await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,
     action:'DONATION_REFUND_'+input.status,objectType:'DONATION',objectId:receiptId,
     summary:'ADMIN attested outgoing refund bank-evidence decision'}});
    return updated;
   },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
  }catch(err){
   const code=(err as {code?:string})?.code;
   if(code==='P2002'||code==='P2034')
    throw new ConflictException('Refund review conflict; reload and retry');
   throw err;
  }
 }
}
