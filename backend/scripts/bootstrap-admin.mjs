import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const require=createRequire(new URL('../package.json',import.meta.url));
const {PrismaClient,Prisma}=require('@prisma/client');
const argon2=require('argon2');
const email=process.env.NISVARTHA_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const displayName=process.env.NISVARTHA_BOOTSTRAP_NAME?.trim();
if(!email||!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)||!displayName){
 console.error('Set NISVARTHA_BOOTSTRAP_EMAIL and NISVARTHA_BOOTSTRAP_NAME. Supply password on stdin.');
 process.exit(2);
}
if(process.stdin.isTTY){console.error('Supply password through secure stdin, not command line arguments.');process.exit(2)}
const password=readFileSync(0,'utf8').trimEnd();
if(password.length<14||password.length>128){console.error('Staff password must be 14-128 characters.');process.exit(2)}
const db=new PrismaClient();
try{
 const hash=await argon2.hash(password,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
 await db.$transaction(async tx=>{
  if(await tx.staffUser.count()!==0)throw Error('Bootstrap refused: staff accounts already exist');
  const id=randomUUID();
  await tx.staffUser.create({data:{id,email,displayName,passwordHash:hash,role:'ADMIN'}});
  await tx.cmsAudit.create({data:{id:randomUUID(),actorId:id,action:'BOOTSTRAP_ADMIN',objectType:'STAFF',objectId:id,summary:'First staff administrator provisioned on trusted host'}});
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
 console.log('Nisvartha first administrator provisioned. No password printed.');
}catch(err){console.error('Administrator bootstrap refused or failed.');process.exitCode=1;
}finally{await db.$disconnect()}
