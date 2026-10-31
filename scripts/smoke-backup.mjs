import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';

const url=process.env.DATABASE_URL;
const container=process.env.VERIFY_MYSQL_CONTAINER;
const password=process.env.VERIFY_MYSQL_ROOT_PASSWORD;
if(!url||new URL(url).pathname!=='/nisvartha_ci'||!container||!password){
 console.error('Backup smoke runs only on explicitly configured isolated nisvartha_ci MySQL.');
 process.exit(2);
}
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
const restoreDb='nisvartha_restore_smoke';
const id=randomUUID(),reference='NF-'+id;
const credentials=['exec','-e','MYSQL_PWD='+password,container];
const run=(cmd,args=[],options={})=>execFileSync('docker',[...credentials,cmd,...args],{
 encoding:'utf8',maxBuffer:12*1024*1024,...options
});
let inserted=false,restored=false;
try{
 await db.enquiry.create({data:{
  id,reference,category:'CONTACT',name:'Synthetic Backup Test',
  email:'backup-test@example.invalid',subject:'Backup integrity',
  message:'Synthetic data for isolated backup and restore regression verification.',
  consentAt:new Date(),privacyVersion:'CI-TEST'
 }});
 inserted=true;
 const dump=run('mysqldump',['-uroot','--single-transaction','--no-tablespaces','nisvartha_ci','enquiries']);
 assert.ok(dump.includes('CREATE TABLE')&&dump.includes(reference),'Incomplete synthetic backup');
 run('mysql',['-uroot','-e','CREATE DATABASE '+restoreDb]);
 restored=true;
 run('mysql',['-uroot',restoreDb],{input:dump});
 const verified=run('mysql',['-uroot','-N','-s','-e',
  "SELECT privacyVersion FROM "+restoreDb+".enquiries WHERE reference='"+reference+"'"]);
 assert.equal(verified.trim(),'CI-TEST','Restored row or consent version differs');
 console.log('Nisvartha isolated MySQL backup and restore smoke: PASS');
}catch{
 console.error('Isolated MySQL backup/restore smoke failed');
 process.exitCode=1;
}finally{
 if(restored)try{run('mysql',['-uroot','-e','DROP DATABASE '+restoreDb]);}catch{process.exitCode=1;}
 if(inserted)await db.enquiry.deleteMany({where:{id}});
 await db.$disconnect();
}
