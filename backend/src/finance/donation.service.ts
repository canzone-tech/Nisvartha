import {BadRequestException,ConflictException,Injectable,NotFoundException} from '@nestjs/common';
import {Prisma,DonationStatus} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {PrismaService} from '../database/prisma.service';
import {StaffPrincipal} from '../staff/staff.dto';
import {RecordDonationDto,ReconcileDonationDto,ListDonationDto} from './donation.dto';

@Injectable()
export class DonationService {
 constructor(private readonly db:PrismaService){}
 private enabled(){
  if(process.env.DONATION_ACCOUNTING_ENABLED!=='true')
   throw new NotFoundException('Offline donation accounting disabled');
 }
 async list(input:ListDonationDto,actor:StaffPrincipal){
  this.enabled();
  const where:Prisma.DonationReceiptWhereInput=input.status&&input.status!=='ALL'?{status:input.status}:{};
  if(input.cursor&&!await this.db.donationReceipt.findFirst({where:{...where,id:input.cursor},select:{id:true}}))
   throw new BadRequestException('Invalid cursor');
  const [rows,pending,reconciled,rejected,total]=await this.db.$transaction([
   this.db.donationReceipt.findMany({where,
    orderBy:[{createdAt:'desc'},{id:'desc'}],take:51,
    ...(input.cursor?{cursor:{id:input.cursor},skip:1}:{}),
    include:{events:{orderBy:{createdAt:'asc'},select:{kind:true,evidenceRef:true,createdAt:true}}}}),
   this.db.donationReceipt.count({where:{status:'PENDING'}}),
   this.db.donationReceipt.count({where:{status:'RECONCILED'}}),
   this.db.donationReceipt.count({where:{status:'REJECTED'}}),
   this.db.donationReceipt.aggregate({where:{status:'RECONCILED'},_sum:{amountPaise:true}})
  ],{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  const items=rows.slice(0,50);
  await this.db.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,
   action:'DONATIONS_VIEWED',objectType:'DONATION',objectId:actor.id,
   summary:'Admin viewed offline donation register'}});
  return {classification:'OFFLINE_DONATIONS_ONLY',counts:{pending,reconciled,rejected},
   reconciledPaise:total._sum.amountPaise??0,items,
   nextCursor:rows.length>50?items[items.length-1].id:null};
 }
 async record(input:RecordDonationDto,actor:StaffPrincipal){
  this.enabled();
  const time=new Date(input.receivedAt);
  if(!/(?:Z|[+-][0-9]{2}:[0-9]{2})$/i.test(input.receivedAt)||
   !Number.isFinite(time.getTime())||time.getTime()>Date.now())
   throw new BadRequestException('Invalid received time');
  const bankReference=input.bankReference.toUpperCase();
  const same=(x:{bankReference:string;amountPaise:number;receivedAt:Date;evidenceRef:string;recordedById:string})=>
   x.bankReference===bankReference&&x.amountPaise===input.amountPaise&&
   x.receivedAt.getTime()===time.getTime()&&x.evidenceRef===input.evidenceRef&&x.recordedById===actor.id;
  const existing=await this.db.donationReceipt.findUnique({where:{requestKey:input.requestKey}});
  if(existing){
   if(!same(existing))throw new ConflictException('Idempotency key reused for different receipt');
   return existing;
  }
  try{
   return await this.db.$transaction(async tx=>{
    const receipt=await tx.donationReceipt.create({data:{id:randomUUID(),
     requestKey:input.requestKey,bankReference,amountPaise:input.amountPaise,
     receivedAt:time,evidenceRef:input.evidenceRef,recordedById:actor.id}});
    await tx.donationEvent.create({data:{id:randomUUID(),receiptId:receipt.id,
     requestKey:input.requestKey,kind:'RECORDED',actorId:actor.id,evidenceRef:input.evidenceRef}});
    await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,
     action:'DONATION_PENDING',objectType:'DONATION',objectId:receipt.id,
     summary:'Standalone donation recorded pending external reconciliation'}});
    return receipt;
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }catch(err){
   if((err as {code?:string}).code==='P2002'){
    const replay=await this.db.donationReceipt.findUnique({where:{requestKey:input.requestKey}});
    if(replay&&same(replay))return replay;
    throw new ConflictException('Bank reference or request key exists');
   }
   throw err;
  }
 }
 async reconcile(id:string,input:ReconcileDonationDto,actor:StaffPrincipal){
  this.enabled();
  try{
   return await this.db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM donation_receipts WHERE id=${id} FOR UPDATE`;
    const receipt=await tx.donationReceipt.findUnique({where:{id}});
    if(!receipt)throw new NotFoundException('Receipt not found');
    const event=await tx.donationEvent.findUnique({where:{requestKey:input.requestKey}});
    if(event){
     if(event.receiptId===id&&event.kind===input.status&&event.evidenceRef===input.evidenceRef&&event.actorId===actor.id)
      return receipt;
     throw new ConflictException('Review key already used');
    }
    if(receipt.status!==DonationStatus.PENDING)
     throw new ConflictException('Receipt decision already finalized');
    const changed=await tx.donationReceipt.update({where:{id},data:{status:input.status}});
    await tx.donationEvent.create({data:{id:randomUUID(),receiptId:id,
     requestKey:input.requestKey,kind:input.status,actorId:actor.id,evidenceRef:input.evidenceRef}});
    await tx.cmsAudit.create({data:{id:randomUUID(),actorId:actor.id,
     action:'DONATION_'+input.status,objectType:'DONATION',objectId:id,
     summary:'Admin recorded bank evidence decision'}});
    return changed;
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }catch(err){
   if((err as {code?:string}).code==='P2002')throw new ConflictException('Review key already used');
   throw err;
  }
 }
}
