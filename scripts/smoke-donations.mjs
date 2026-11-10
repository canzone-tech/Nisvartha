import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
if(!process.env.DATABASE_URL||new URL(process.env.DATABASE_URL).pathname!=='/nisvartha_ci')
 throw Error('Donation test requires disposable MySQL');
const db=new PrismaClient();
const port=await new Promise((resolve,reject)=>{
 const s=createServer();s.once('error',reject);
 s.listen(0,'127.0.0.1',()=>{const addr=s.address();const p=addr&&typeof addr!=='string'?addr.port:0;s.close(()=>resolve(p))});
});
const base='http://127.0.0.1:'+port+'/api/v1';
const existing=await db.staffUser.findFirst({select:{id:true}});
const staffId=existing?.id??randomUUID();
const own=!existing;
const bank='TST-'+randomUUID(),requestKey=randomUUID(),reviewKey=randomUUID();
const token=randomBytes(32).toString('base64url');
const sessionId=randomUUID();
let child;
async function call(path,method='GET',body,auth=true){
 const response=await fetch(base+path,{method,
  headers:{...(auth?{Authorization:'Bearer '+token}:{}),
   ...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 return {status:response.status,data:await response.json().catch(()=>null)};
}
try{
 if(own)await db.staffUser.create({data:{id:staffId,
  email:'donation-operator-'+randomUUID()+'@example.invalid',
  displayName:'Disposable donation admin',
  passwordHash:'NOT_REAL',role:'ADMIN'}});
 await db.staffSession.create({data:{id:sessionId,staffId,
  tokenHash:createHash('sha256').update(token).digest('hex'),
  expiresAt:new Date(Date.now()+120000)}});
 child=spawn(process.execPath,['backend/dist/main.js'],{env:{
  ...process.env,PORT:String(port),HOST:'127.0.0.1',
  DONATION_ACCOUNTING_ENABLED:'true'
 },stdio:'ignore',detached:true});
 let ready=false;
 for(let n=0;n<80;n++){
  if(child.exitCode!==null)throw Error('API exited early');
  try{if((await call('/health/ready','GET',undefined,false)).status===200){ready=true;break}}catch{}
  await new Promise(done=>setTimeout(done,175));
 }
 assert.ok(ready,'Compiled API startup failed');
 assert.equal((await call('/staff/donations','GET',undefined,false)).status,401);
 const input={requestKey,bankReference:bank,amountPaise:19500,
  receivedAt:new Date(Date.now()-60000).toISOString(),evidenceRef:'STATEMENT_TEST_001'};
 const created=await call('/staff/donations','POST',input);
 assert.equal(created.status,200,'Donation record: '+JSON.stringify(created.data));
 assert.equal(created.data.status,'PENDING');
 const receiptId=created.data.id;
 assert.equal((await call('/staff/donations','POST',input)).data.id,receiptId);
 assert.equal((await call('/staff/donations','POST',{...input,amountPaise:20000})).status,409);
 assert.equal((await call('/staff/donations','POST',{...input,requestKey:randomUUID()})).status,409);
 const before=await call('/staff/donations');
 assert.equal(before.status,200);
 assert.equal(before.data.reconciledPaise,0);
 const decision={requestKey:reviewKey,status:'RECONCILED',evidenceRef:'RECON_TEST_001'};
 const parallel=await Promise.all([
  call('/staff/donations/'+receiptId+'/reconcile','POST',decision),
  call('/staff/donations/'+receiptId+'/reconcile','POST',decision)
 ]);
 assert.ok(parallel.some(x=>x.status===200),'Both reconciliation requests failed');
 assert.equal((await call('/staff/donations/'+receiptId+'/reconcile','POST',decision)).status,200);
 assert.equal((await call('/staff/donations/'+receiptId+'/reconcile','POST',
  {...decision,requestKey:randomUUID(),status:'REJECTED'})).status,409);
 const after=await call('/staff/donations');
 assert.equal(after.data.reconciledPaise,19500);
 assert.equal(await db.donationReceipt.count({where:{bankReference:bank}}),1);
 assert.equal(await db.donationEvent.count({where:{receiptId}}),2);
 const refundUrl='/staff/donations/'+receiptId+'/refunds';
 assert.equal((await call(refundUrl,'GET',undefined,false)).status,401,
  'Refund evidence leaked to anonymous user');
 const refundInput={requestKey:randomUUID(),bankReference:'OUT-'+randomUUID(),
  amountPaise:7000,evidenceRef:'REFUND_INITIATION_001'};
 const pendingRefund=await call(refundUrl,'POST',refundInput);
 assert.equal(pendingRefund.status,200,'Create refund failed: '+JSON.stringify(pendingRefund.data));
 assert.equal(pendingRefund.data.status,'PENDING');
 const refundId=pendingRefund.data.id;
 assert.equal((await call(refundUrl,'POST',refundInput)).data.id,refundId,
  'Refund request replay created another reservation');
 assert.equal((await call(refundUrl,'POST',{...refundInput,amountPaise:6000})).status,409,
  'Refund idempotency key accepted different amount');
 const reserved=await call(refundUrl);
 assert.equal(reserved.status,200);
 assert.equal(reserved.data.reservedPaise,'7000');
 assert.equal(reserved.data.availablePaise,'12500');
 assert.equal((await call('/staff/donations')).data.netReconciledPaise,'19500',
  'Pending refunds must not reduce net cleared donations');
 const overspend={requestKey:randomUUID(),bankReference:'OUT-'+randomUUID(),
  amountPaise:14000,evidenceRef:'REFUND_INITIATION_002'};
 assert.equal((await call(refundUrl,'POST',overspend)).status,409,
  'Refund exceeding unreserved donation amount accepted');
 const competing=[{requestKey:randomUUID(),bankReference:'OUT-'+randomUUID(),
   amountPaise:9000,evidenceRef:'REFUND_INITIATION_003'},
  {requestKey:randomUUID(),bankReference:'OUT-'+randomUUID(),
   amountPaise:9000,evidenceRef:'REFUND_INITIATION_004'}];
 const race=await Promise.all(competing.map(x=>call(refundUrl,'POST',x)));
 assert.equal(race.filter(x=>x.status===200).length,1,
  'Concurrent refunds over-reserved original receipt');
 assert.equal(race.filter(x=>x.status===409).length,1,
  'Concurrent refund overage must be conflict');
 const winner=race.find(x=>x.status===200);
 assert.ok(winner?.data?.id);
 const listWithRace=await call(refundUrl);
 assert.equal(listWithRace.data.reservedPaise,'16000');
 const rejectInput={requestKey:randomUUID(),status:'REJECTED',evidenceRef:'REJECT_STATEMENT_001'};
 const rejected=await call(refundUrl+'/'+winner.data.id+'/reconcile','POST',rejectInput);
 assert.equal(rejected.status,200,'Refund rejection failed');
 assert.equal((await call(refundUrl+'/'+winner.data.id+'/reconcile','POST',rejectInput)).status,200);
 assert.equal((await call(refundUrl)).data.reservedPaise,'7000',
  'Rejected pending refund must release reservation');
 const confirmInput={requestKey:randomUUID(),status:'CONFIRMED',evidenceRef:'BANK_OUTGOING_001'};
 const confirmed=await call(refundUrl+'/'+refundId+'/reconcile','POST',confirmInput);
 assert.equal(confirmed.status,200,'Refund bank-evidence confirmation failed');
 assert.equal((await call(refundUrl+'/'+refundId+'/reconcile','POST',confirmInput)).status,200,
  'Same refund decision not idempotent');
 assert.equal((await call(refundUrl+'/'+refundId+'/reconcile','POST',
  {...confirmInput,requestKey:randomUUID(),status:'REJECTED'})).status,409,
  'Confirmed refund was reversed without an adjustment');
 assert.equal((await call(refundUrl)).data.confirmedPaise,'7000');
 const net=await call('/staff/donations');
 assert.equal(net.data.confirmedRefundPaise,7000);
 assert.equal(net.data.netReconciledPaise,'12500');
 assert.equal(await db.donationRefund.count({where:{receiptId}}),2);
 assert.equal(await db.donationRefundEvent.count({where:{refund:{receiptId}}}),4);
 console.log('Single-Admin donations + partial refunds, row-lock reservations, replay and net reconciliation: PASS');
}finally{
 if(child?.pid){try{process.kill(-child.pid,'SIGTERM')}catch{}
  await Promise.race([new Promise(done=>child.once('exit',done)),
   new Promise(done=>setTimeout(done,1500))]);}
 const receipt=await db.donationReceipt.findUnique({where:{bankReference:bank}});
 if(receipt){
  await db.donationRefundEvent.deleteMany({where:{refund:{receiptId:receipt.id}}});
  await db.donationRefund.deleteMany({where:{receiptId:receipt.id}});
  await db.donationEvent.deleteMany({where:{receiptId:receipt.id}});
  await db.donationReceipt.delete({where:{id:receipt.id}});
  await db.cmsAudit.deleteMany({where:{objectType:'DONATION',objectId:receipt.id}});
 }
 await db.cmsAudit.deleteMany({where:{actorId:staffId,action:'DONATIONS_VIEWED'}});
 await db.staffSession.deleteMany({where:{id:sessionId}});
 if(own)await db.staffUser.deleteMany({where:{id:staffId}});
 await db.$disconnect();
}
