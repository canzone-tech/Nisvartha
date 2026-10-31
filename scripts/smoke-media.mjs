import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const sharp=require('sharp');
const argon2=require('argon2');
if(!process.env.MEDIA_STORAGE_ROOT||!process.env.MEDIA_SCANNER_BIN)throw Error('Media smoke requires isolated storage and test scanner');
if(!process.env.DATABASE_URL||new URL(process.env.DATABASE_URL).pathname!=='/nisvartha_ci')throw Error('Refusing media smoke outside isolated CI database');
const db=new PrismaClient();
const editorId=randomUUID(),approverId=randomUUID(),mediaIds=[];
const password='CI-Media-Only-Synthetic-Password';
const email='media-'+editorId.slice(0,8)+'@example.invalid';
const approverEmail='review-'+approverId.slice(0,8)+'@example.invalid';
const port=await new Promise((resolve,reject)=>{const server=createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const address=server.address();if(!address||typeof address==='string')return reject(Error('No port'));server.close(()=>resolve(address.port));});});
const base='http://127.0.0.1:'+port+'/api/v1';
let child;
async function api(path,method='GET',body,token){
 const response=await fetch(base+path,{method,headers:token?{Authorization:'Bearer '+token}:undefined,body});
 const raw=await response.text();
 let data;try{data=JSON.parse(raw)}catch{data=raw}
 return {status:response.status,data,response};
}
const json=(body)=>JSON.stringify(body);
async function upload(token,bytes,type='image/png',rights='true',consent='true'){
 const form=new FormData();
 form.append('file',new Blob([bytes],{type}),'uploaded-image.png');
 form.append('title','Verified synthetic tree activity');
 form.append('altText','A synthetic CI test image for the foundation gallery');
 form.append('caption','CI-only test image; not a real beneficiary photo');
 form.append('rightsConfirmed',rights);
 form.append('consentConfirmed',consent);
 return api('/cms/media/upload','POST',form,token);
}
try{
 const hash=await argon2.hash(password,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
 await db.staffUser.createMany({data:[
  {id:editorId,email,displayName:'CI image editor',passwordHash:hash,role:'EDITOR'},
  {id:approverId,email:approverEmail,displayName:'CI image approver',passwordHash:hash,role:'APPROVER'}
 ]});
 child=spawn(process.execPath,['backend/dist/main.js'],{env:{...process.env,PORT:String(port)},stdio:'ignore',detached:true});
 let ready=false;
 for(let i=0;i<90;i++){if(child.exitCode!==null)throw Error('Compiled NestJS exited');try{if((await fetch(base+'/health/ready')).ok){ready=true;break}}catch{}await new Promise(resolve=>setTimeout(resolve,180))}
 assert.ok(ready,'Compiled NestJS not ready');
 async function login(staffEmail){
  const result=await api('/staff/login','POST',json({email:staffEmail,password}));
  assert.equal(result.status,200);return result.data.accessToken;
 }
 const editor=await login(email),approver=await login(approverEmail);
 const png=await sharp({create:{width:16,height:16,channels:3,background:'#2f7349'}}).png().toBuffer();
 assert.equal((await upload(undefined,png)).status,401,'Anonymous upload must fail');
 assert.equal((await upload(approver,png)).status,403,'Approver must not upload');
 assert.equal((await upload(editor,png,'image/png','false')).status,400,'Missing rights must block upload');
 assert.equal((await upload(editor,png,'image/png','true','false')).status,400,'Missing consent must block upload');
 assert.equal((await upload(editor,Buffer.from('not actually an image'))).status,400,'Faked image bytes must be rejected');
 const eicar=Buffer.concat([png,Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')]);
 assert.equal((await upload(editor,eicar)).status,503,'Scanner detection must fail closed');
 const saved=await upload(editor,png);
 assert.equal(saved.status,201,'Valid synthetic image upload failed: '+JSON.stringify(saved.data));
 const id=saved.data.id;mediaIds.push(id);
 assert.equal(saved.data.status,'DRAFT');
 assert.equal((await api('/public/media/'+id)).status,404,'Private media exposed before review');
 let gallery=await api('/public/gallery');
 assert.equal(gallery.status,200);
 assert.ok(!gallery.data.some(x=>x.id===id),'Draft appeared in public gallery');
 assert.equal((await api('/cms/media/'+id+'/submit','POST',json({}),approver)).status,403);
 assert.equal((await api('/cms/media/'+id+'/submit','POST',json({}),editor)).status,201);
 assert.equal((await api('/cms/media/'+id+'/approve','POST',json({}),editor)).status,403,'Uploader approved own image');
 assert.equal((await api('/cms/media/'+id+'/approve','POST',json({}),approver)).status,201);
 gallery=await api('/public/gallery');
 assert.ok(gallery.data.some(x=>x.id===id&&x.altText.includes('synthetic CI')),'Approved image missing gallery');
 const image=await fetch(base+'/public/media/'+id);
 assert.equal(image.status,200);
 assert.match(image.headers.get('content-type')||'',/image\/webp/);
 const data=Buffer.from(await image.arrayBuffer());
 assert.equal(data.toString('ascii',0,4),'RIFF');
 assert.equal(data.toString('ascii',8,12),'WEBP');
 const metadata=await sharp(data).metadata();
 assert.equal(metadata.width,16);assert.equal(metadata.height,16);
 assert.equal(metadata.exif,undefined,'Image metadata not stripped');
 assert.equal((await api('/cms/media/'+id+'/archive','POST',json({}),approver)).status,201);
 assert.equal((await api('/public/media/'+id)).status,404,'Archived image still accessible');
 assert.ok(!(await api('/public/gallery')).data.some(x=>x.id===id));
 assert.ok((await db.cmsAudit.findMany({where:{objectType:'MEDIA',objectId:id}})).some(x=>x.action==='MEDIA_PUBLISH'));
 console.log('Nisvartha private local image upload, scanner gate, rights/consent, RBAC, sanitize, review and archive: PASS');
}finally{
 if(child?.pid){
  const exited=new Promise(resolve=>child.once('exit',resolve));
  try{process.kill(-child.pid,'SIGTERM')}catch{}
  await Promise.race([exited,new Promise(resolve=>setTimeout(resolve,2500))]);
 }
 await db.cmsMedia.deleteMany({where:{id:{in:mediaIds}}});
 await db.staffSession.deleteMany({where:{staffId:{in:[editorId,approverId]}}});
 await db.cmsAudit.deleteMany({where:{actorId:{in:[editorId,approverId]}}});
 await db.staffUser.deleteMany({where:{id:{in:[editorId,approverId]}}});
 for(const id of mediaIds)await rm(join(process.env.MEDIA_STORAGE_ROOT,'objects',id+'.webp'),{force:true}).catch(()=>{});
 await db.$disconnect();
}
