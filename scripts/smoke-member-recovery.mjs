import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';

const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const argon2=require('argon2');
if(!process.env.DATABASE_URL||new URL(process.env.DATABASE_URL).pathname!=='/nisvartha_ci')
 throw Error('Recovery smoke only runs against isolated nisvartha_ci database');
const db=new PrismaClient(),seed=randomUUID().slice(0,8);
const staffIds=[randomUUID(),randomUUID()],memberEmail='recover-'+seed+'@example.invalid';
const staffEmails=['recovery-admin-'+seed+'@example.invalid','recovery-reviewer-'+seed+'@example.invalid'];
const oldPassword='Synthetic-Recovery-Original-2026',newPassword='Synthetic-Recovery-Replaced-2026';
const staffPassword='Synthetic-Recovery-Staff-2026';
const port=await new Promise((resolve,reject)=>{
 const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{
  const addr=s.address();if(!addr||typeof addr==='string')return reject(Error('Port unavailable'));
  s.close(()=>resolve(addr.port));
 });
});
const api='http://127.0.0.1:'+port+'/api/v1';
let child,memberId,applicationId;
async function call(path,method='GET',body,token){
 const response=await fetch(api+path,{
  method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const raw=await response.text();let data;
 try{data=JSON.parse(raw)}catch{data=raw}
 return {status:response.status,data,headers:response.headers};
}
const hashes=(raw)=>createHash('sha256').update('nisvartha:member-recovery:v1:'+raw).digest('hex');
try{
 const hash=await argon2.hash(staffPassword,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
 await db.staffUser.createMany({data:staffIds.map((id,i)=>({
  id,email:staffEmails[i],displayName:'Synthetic recovery staff',passwordHash:hash,role:i===0?'ADMIN':'APPROVER'
 }))});
 child=spawn(process.execPath,['backend/dist/main.js'],{
  env:{...process.env,PORT:String(port),MEMBER_PORTAL_ENABLED:'true',MEMBER_RECOVERY_ENABLED:'true',
   MEMBER_APPLICATIONS_ENABLED:'true',MEMBER_TERMS_VERSION:'ci-recovery-terms',MEMBER_PRIVACY_VERSION:'ci-recovery-privacy'},
  stdio:'ignore',detached:true
 });
 let healthy=false;
 for(let i=0;i<90;i++){
  if(child.exitCode!==null)throw Error('Compiled backend unexpectedly exited');
  try{if((await fetch(api+'/health/ready')).ok){healthy=true;break}}catch{}
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 assert.ok(healthy,'Compiled recovery API readiness timed out');
 const registration=await call('/members/register','POST',{
  email:memberEmail,displayName:'Synthetic member recovery subject',
  password:oldPassword,termsVersion:'ci-recovery-terms',privacyVersion:'ci-recovery-privacy',
  consent:true,communicationOptIn:false
 });
 assert.equal(registration.status,201,'Member registration failed');
 memberId=registration.data.id;applicationId=registration.data.applicationReference;
 const login=await call('/members/login','POST',{email:memberEmail,password:oldPassword});
 assert.equal(login.status,200);
 const oldToken=login.data.accessToken;
 const [admin,reviewer]=await Promise.all(staffEmails.map(async email=>{
  const res=await call('/staff/login','POST',{email,password:staffPassword});
  assert.equal(res.status,200);return res.data.accessToken;
 }));
 const endpoint='/cms/membership/recovery/'+memberId+'/issue';
 const proof={identityVerified:true,identityEvidenceRef:'IDENTITY-CI-2026-0001'};
 assert.equal((await call(endpoint,'POST',proof)).status,401,'Anonymous issuance must be denied');
 assert.equal((await call(endpoint,'POST',proof,reviewer)).status,403,'APPROVER must not issue recovery codes');
 assert.equal((await call(endpoint,'POST',{...proof,identityVerified:false},admin)).status,400);
 assert.equal((await call(endpoint,'POST',{...proof,identityEvidenceRef:'invalid secret or url'},admin)).status,400);
 const issued=await call(endpoint,'POST',proof,admin);
 assert.equal(issued.status,200,'Verified admin issuance failed '+JSON.stringify(issued.data));
 assert.match(issued.headers.get('cache-control')||'',/no-store/);
 assert.match(issued.data.code,/^[A-Za-z0-9_-]{43}$/);
 assert.equal((await call(endpoint,'POST',proof,admin)).status,409,'Reissue cooldown must prevent multiple valid codes');
 const stored=await db.memberPasswordRecovery.findUniqueOrThrow({where:{tokenHash:hashes(issued.data.code)}});
 assert.equal(stored.memberId,memberId);
 assert.equal(stored.identityEvidenceRef,proof.identityEvidenceRef);
 assert.notEqual(stored.tokenHash,issued.data.code,'Plaintext recovery code must not be stored');
 assert.equal((await call('/members/recovery/redeem','POST',{code:'bad',newPassword:newPassword})).status,400);
 const invalid='a'.repeat(43);
 assert.equal((await call('/members/recovery/redeem','POST',{code:invalid,newPassword:newPassword})).status,401);
 const [first,second]=await Promise.all([
  call('/members/recovery/redeem','POST',{code:issued.data.code,newPassword:newPassword}),
  call('/members/recovery/redeem','POST',{code:issued.data.code,newPassword:newPassword})
 ]);
 assert.deepEqual([first.status,second.status].sort(),[200,401],
  'Concurrent redemption must consume one code only: '+first.status+','+second.status);
 assert.equal((await call('/members/me','GET',undefined,oldToken)).status,401,'Old session must be revoked');
 assert.equal((await call('/members/login','POST',{email:memberEmail,password:oldPassword})).status,401,'Old credential still active');
 assert.equal((await call('/members/login','POST',{email:memberEmail,password:newPassword})).status,200,'New credential not activated');
 assert.ok((await db.memberPasswordRecovery.findUniqueOrThrow({where:{id:stored.id}})).usedAt);
 const expiredCode='b'.repeat(43);
 await db.memberPasswordRecovery.create({data:{
  id:randomUUID(),memberId,issuerId:staffIds[0],tokenHash:hashes(expiredCode),
  identityEvidenceRef:'IDENTITY-CI-EXPIRED',
  expiresAt:new Date(Date.now()-1000)
 }});
 assert.equal((await call('/members/recovery/redeem','POST',{code:expiredCode,newPassword:'Synthetic-Third-Password-2026'})).status,401,
  'Expired recovery code must not reset password');
 assert.equal((await call('/members/login','POST',{email:memberEmail,password:newPassword})).status,200);
 const staffAudit=await db.cmsAudit.findMany({where:{actorId:staffIds[0],action:'MEMBER_PASSWORD_RECOVERY_ISSUED'}});
 assert.ok(staffAudit.some(x=>x.objectId===memberId));
 assert.ok(staffAudit.every(x=>!x.summary.includes(issued.data.code)),'Code leaked into staff audit');
 const memberAudit=await db.memberAudit.findMany({where:{memberId}});
 assert.ok(memberAudit.some(x=>x.action==='PASSWORD_RECOVERED_SESSIONS_REVOKED'));
 await db.memberAccount.update({where:{id:memberId},data:{status:'SUSPENDED'}});
 // Explicit suspended account denial cannot be bypassed by staff.
 await db.memberPasswordRecovery.updateMany({where:{memberId},data:{createdAt:new Date(Date.now()-10*60_000)}});
 assert.equal((await call(endpoint,'POST',proof,admin)).status,403);
 console.log('Verified staff issue, private token, concurrent single-use reset, expiry, revocation and RBAC: PASS');
}finally{
 if(child?.pid){const exited=new Promise(resolve=>child.once('exit',resolve));
  try{process.kill(-child.pid,'SIGTERM')}catch{}
  await Promise.race([exited,new Promise(resolve=>setTimeout(resolve,2500))]);}
 if(memberId){
  await db.memberPasswordRecovery.deleteMany({where:{memberId}});
  if(applicationId)await db.membershipApplication.deleteMany({where:{id:applicationId}});
  await db.memberSession.deleteMany({where:{memberId}});
  await db.memberAudit.deleteMany({where:{memberId}});
  await db.memberAccount.deleteMany({where:{id:memberId}});
 }
 await db.cmsAudit.deleteMany({where:{actorId:{in:staffIds}}});
 await db.staffSession.deleteMany({where:{staffId:{in:staffIds}}});
 await db.staffUser.deleteMany({where:{id:{in:staffIds}}});
 await db.$disconnect();
}
