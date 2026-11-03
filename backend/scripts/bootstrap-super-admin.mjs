import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';

// New-installation root-of-trust only. Existing staff instances require a
// separate reviewed operator migration, never an in-app promotion.
const require=createRequire(new URL('../package.json',import.meta.url));
const {PrismaClient,Prisma}=require('@prisma/client');
const argon2=require('argon2');
const email=process.env.NISVARTHA_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const displayName=process.env.NISVARTHA_BOOTSTRAP_NAME?.trim();
const approvalRef=process.env.NISVARTHA_SUPER_ADMIN_SECURITY_APPROVAL_REF?.trim();
if(process.env.NISVARTHA_SUPER_ADMIN_BOOTSTRAP_CONFIRM!=='CREATE_FIRST_STAFF_SUPER_ADMIN'
 || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
 || !displayName || displayName.length<2 || displayName.length>120
 || !approvalRef || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,119}$/.test(approvalRef)){
 console.error('Explicit bootstrap confirmation, staff email/name and offline security approval reference required.');
 process.exit(2);
}
if(process.stdin.isTTY){console.error('Supply the password through secure stdin, not command arguments.');process.exit(2)}
const password=readFileSync(0,'utf8').trimEnd();
if(password.length<14||password.length>128){console.error('Staff password must be 14-128 characters.');process.exit(2)}
const db=new PrismaClient();
try{
 const hash=await argon2.hash(password,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
 await db.$transaction(async tx=>{
  // SERIALIZABLE prevents two concurrent first-user bootstrap operations.
  if(await tx.staffUser.count()!==0)throw Error('First staff bootstrap only; existing staff detected');
  const id=randomUUID();
  await tx.staffUser.create({data:{id,email,displayName,passwordHash:hash,role:'SUPER_ADMIN'}});
  await tx.cmsAudit.create({data:{id:randomUUID(),actorId:id,action:'BOOTSTRAP_SUPER_ADMIN',
   objectType:'STAFF',objectId:id,
   summary:'First SUPER_ADMIN provisioned on trusted host; security approval reference '+approvalRef}});
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
 console.log('First SUPER_ADMIN provisioned. No password or bearer token printed.');
}catch{
 console.error('SUPER_ADMIN bootstrap refused or failed; no staff account was modified.');
 process.exitCode=1;
}finally{await db.$disconnect()}
