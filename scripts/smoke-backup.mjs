import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {copyFileSync,existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';

// This program MUST NOT operate against any real/production database or media
// tree. It verifies that a synthetic MySQL snapshot and private image bytes can
// be restored together with identical metadata and checksums.
const url=process.env.DATABASE_URL;
const container=process.env.VERIFY_MYSQL_CONTAINER;
const password=process.env.VERIFY_MYSQL_ROOT_PASSWORD;
const mediaRoot=process.env.MEDIA_STORAGE_ROOT||'';
if(!url||new URL(url).pathname!=='/nisvartha_ci'||!container||!password||
   !/^\/tmp\/nisvartha-(?:private-media-|media-ci-)[A-Za-z0-9_-]+$/.test(mediaRoot)){
 console.error('Backup smoke runs only against isolated nisvartha_ci MySQL and disposable test media.');
 process.exit(2);
}
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const sharp=require('sharp');
const db=new PrismaClient();
const restoreDb='nisvartha_restore_smoke';
const id=randomUUID(),reference='NF-'+id;
const staffId=randomUUID(),mediaId=randomUUID();
const fileKey=mediaId+'.webp';
const sourceObject=join(mediaRoot,'objects',fileKey);
const restoreRoot=mkdtempSync(join(tmpdir(),'nisvartha-media-restore-'));
const restoredObject=join(restoreRoot,'objects',fileKey);
const run=(cmd,args=[],options={})=>execFileSync('docker',['exec',...(options.input===undefined?[]:['-i']),
 '-e','MYSQL_PWD='+password,container,cmd,...args],{
 encoding:'utf8',maxBuffer:12*1024*1024,...options
});
let enquiryInserted=false,staffInserted=false,mediaInserted=false,restored=false;
try{
 await db.enquiry.create({data:{
  id,reference,category:'CONTACT',name:'Synthetic Backup Test',
  email:'backup-test@example.invalid',subject:'Backup integrity',
  message:'Synthetic data for isolated backup and restore regression verification.',
  consentAt:new Date(),privacyVersion:'CI-TEST'
 }});
 enquiryInserted=true;
 await db.staffUser.create({data:{
  id:staffId,email:'backup-'+staffId.slice(0,8)+'@example.invalid',
  displayName:'Synthetic Media Backup Operator',
  role:'ADMIN',passwordHash:'NOT_A_REAL_PASSWORD_HASH'
 }});
 staffInserted=true;
 const bytes=await sharp({create:{
  width:8,height:8,channels:3,background:{r:30,g:120,b:170}
 }}).webp().toBuffer();
 const digest=createHash('sha256').update(bytes).digest('hex');
 mkdirSync(join(mediaRoot,'objects'),{recursive:true,mode:0o700});
 writeFileSync(sourceObject,bytes,{flag:'wx',mode:0o600});
 await db.cmsMedia.create({data:{
  id:mediaId,fileKey,sha256:digest,mimeType:'image/webp',bytes:bytes.length,
  width:8,height:8,title:'Synthetic private backup media',
  altText:'Synthetic generated colored image',rightsConfirmed:true,
  consentConfirmed:true,rightsEvidenceRef:'RIGHTS-SYNTHETIC-BACKUP',
  consentEvidenceRef:'CONSENT-SYNTHETIC-BACKUP',
  status:'DRAFT',uploaderId:staffId
 }});
 mediaInserted=true;
 const dump=run('mysqldump',['-uroot','--single-transaction',
  '--no-tablespaces','nisvartha_ci','enquiries','staff_users','cms_media']);
 assert.ok(dump.includes('CREATE TABLE')&&dump.includes(reference)&&dump.includes(mediaId),
  'Synthetic database snapshot missing linked media metadata');
 // Quiescent synthetic filesystem snapshot, then restore independently.
 mkdirSync(join(restoreRoot,'objects'),{recursive:true,mode:0o700});
 copyFileSync(sourceObject,restoredObject);
 run('mysql',['-uroot','-e','CREATE DATABASE '+restoreDb]);
 restored=true;
 run('mysql',['-uroot',restoreDb],{input:dump});
 const savedConsent=run('mysql',['-uroot','-N','-s','-e',
  "SELECT privacyVersion FROM "+restoreDb+".enquiries WHERE reference='"+reference+"'"]);
 assert.equal(savedConsent.trim(),'CI-TEST','Restored enquiry consent data differs');
 const row=run('mysql',['-uroot','-N','-s','-e',
  "SELECT sha256, fileKey FROM "+restoreDb+".cms_media WHERE id='"+mediaId+"'"]).trim();
 assert.equal(row,digest+'\t'+fileKey,'Restored media metadata differs');
 assert.ok(existsSync(restoredObject),'Restored private image missing');
 assert.equal(createHash('sha256').update(readFileSync(restoredObject)).digest('hex'),digest,
  'Restored private image bytes disagree with authoritative MySQL SHA-256');
 console.log('Nisvartha isolated MySQL + private media paired snapshot/restore and digest smoke: PASS');
}catch{
 console.error('Isolated MySQL + media paired restore smoke failed');
 process.exitCode=1;
}finally{
 if(restored)try{run('mysql',['-uroot','-e','DROP DATABASE '+restoreDb])}
  catch{process.exitCode=1;}
 if(mediaInserted)await db.cmsMedia.deleteMany({where:{id:mediaId}});
 if(staffInserted)await db.staffUser.deleteMany({where:{id:staffId}});
 if(enquiryInserted)await db.enquiry.deleteMany({where:{id}});
 rmSync(sourceObject,{force:true});
 rmSync(restoreRoot,{recursive:true,force:true});
 await db.$disconnect();
}
