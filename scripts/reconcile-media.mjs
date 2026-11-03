// Read-only recovery check: MySQL metadata remains authoritative.
// Does not repair, publish, delete files, or print consent evidence references.
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {lstat,readdir,realpath} from 'node:fs/promises';
import {isAbsolute,join,resolve} from 'node:path';
import {createRequire} from 'node:module';

const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const root=process.env.MEDIA_STORAGE_ROOT;
if(!root||!isAbsolute(root)||root==='/'||root.length<5)throw new Error('MEDIA_STORAGE_ROOT must be a private absolute path');
const objects=join(resolve(root),'objects');
const rootStat=await lstat(root),objectStat=await lstat(objects);
if(!rootStat.isDirectory()||!objectStat.isDirectory()||rootStat.isSymbolicLink()||objectStat.isSymbolicLink())
 throw new Error('Refusing non-directory or symlink media storage');
const resolvedRoot=await realpath(root),resolvedObjects=await realpath(objects);
if(resolvedObjects!==join(resolvedRoot,'objects'))throw new Error('Media objects path escapes configured root');

const db=new PrismaClient();
const expected=new Set(),errors=[];
let approved=0,checked=0,missing=0,corrupt=0,unsafe=0,orphans=0;
const pattern=/^[0-9a-f-]{36}[.]webp$/;
try{
 let cursor;
 do{
  const page=await db.cmsMedia.findMany({
   select:{id:true,fileKey:true,sha256:true,bytes:true,status:true},
   orderBy:{id:'asc'},take:200,
   ...(cursor?{cursor:{id:cursor},skip:1}:{})
  });
  if(!page.length)break;
  cursor=page[page.length-1].id;
  for(const row of page){
   if(!pattern.test(row.fileKey)||row.fileKey!==row.id+'.webp'){
    unsafe++;errors.push({id:row.id,problem:'unsafe_file_key'});continue;
   }
   expected.add(row.fileKey);
   // Drafts/rejections/archived images are valid private objects but not
   // publicly accessible. Only approved images require release checks.
   if(row.status!=='APPROVED')continue;
   approved++;
   const filename=join(objects,row.fileKey);
   try{
    const info=await lstat(filename);
    if(!info.isFile()||info.isSymbolicLink()){
     unsafe++;errors.push({id:row.id,problem:'unsafe_file_type'});continue;
    }
    if(info.size!==row.bytes){
     corrupt++;errors.push({id:row.id,problem:'length_mismatch'});continue;
    }
    const checksum=createHash('sha256');
    for await(const chunk of createReadStream(filename))checksum.update(chunk);
    if(checksum.digest('hex')!==row.sha256){
     corrupt++;errors.push({id:row.id,problem:'checksum_mismatch'});continue;
    }
    checked++;
   }catch(e){
    if(e?.code==='ENOENT'){missing++;errors.push({id:row.id,problem:'missing_file'});}
    else{unsafe++;errors.push({id:row.id,problem:'unreadable_file'});}
   }
  }
  if(page.length<200)break;
 }while(true);
 const entries=await readdir(objects,{withFileTypes:true});
 for(const item of entries){
  if(!item.isFile()||item.isSymbolicLink()||!pattern.test(item.name)||!expected.has(item.name)){
   orphans++;
   // Avoid printing arbitrary attacker-controlled filenames or private details.
   errors.push({problem:'unreferenced_or_unsafe_file'});
  }
 }
 const result={approved,verified:checked,missing,corrupt,unsafe,unreferencedOrUnsafe:orphans,ok:errors.length===0};
 process.stdout.write(JSON.stringify(result)+'\n');
 if(errors.length){
  process.stderr.write('Local media reconciliation detected inconsistencies: '+JSON.stringify(errors.slice(0,20))+'\n');
  process.exitCode=1;
 }
}finally{await db.$disconnect();}
