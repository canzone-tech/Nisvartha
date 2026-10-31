import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const argon2=require('argon2');
const db=new PrismaClient();
const staffIds=[randomUUID(),randomUUID()];
const slug='ci-cms-proj-'+randomUUID();
const email=staffIds.map(x=>'cross-'+x.slice(0,8)+'@example.invalid');
const password='Synthetic-Test-Password-2026';
const allocate=()=>new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const a=s.address();if(!a||typeof a==='string')return reject(Error('No port'));s.close(()=>resolve(a.port));});});
const apiPort=await allocate(),webPort=await allocate();
const api='http://127.0.0.1:'+apiPort+'/api/v1',web='http://127.0.0.1:'+webPort;
let app,site,contentId;
const post=async(path,token,body)=>{
 const response=await fetch(api+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body),cache:'no-store'});
 const raw=await response.text();
 let data;try{data=JSON.parse(raw)}catch{data=raw}
 return {status:response.status,data};
};
const waitReady=async(origin)=>{
 for(let i=0;i<80;i++){
  try{const result=await fetch(origin);if(result.ok)return;}catch{}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 throw new Error('Compiled application not ready '+origin);
};
try{
 const hash=await argon2.hash(password,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
 await db.staffUser.createMany({data:staffIds.map((id,i)=>({id,email:email[i],displayName:'CMS Crossapp Test',role:i===0?'EDITOR':'APPROVER',passwordHash:hash}))});
 app=spawn(process.execPath,['backend/dist/main.js'],{env:{...process.env,PORT:String(apiPort)},stdio:'ignore',detached:true});
 await waitReady(api+'/health/ready');
 site=spawn('npm',['--prefix','frontend','run','start','--','-p',String(webPort)],{env:{...process.env,CMS_PUBLIC_CONTENT_ENABLED:'true',API_INTERNAL_URL:'http://127.0.0.1:'+apiPort},stdio:'ignore',detached:true});
 await waitReady(web);
 let page=await (await fetch(web+'/projects',{cache:'no-store'})).text();
 assert.ok(!page.includes(slug),'Unpublished project appeared before creation');
 const tokens=[];
 for(const staffEmail of email){
  const response=await fetch(api+'/staff/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:staffEmail,password})});
  assert.equal(response.status,200,'Staff login in crossapp test');
  tokens.push((await response.json()).accessToken);
 }
 const created=await post('/cms/contents',tokens[0],{slug,kind:'PROJECT',title:'Verified cross-app project',summary:'Published summary',body:'This published information is checked in CI.'});
 assert.equal(created.status,201,'CMS creation failed');contentId=created.data.content.id;
 assert.equal((await post('/cms/revisions/'+created.data.revision.id+'/submit',tokens[0],{})).status,201);
 assert.equal((await post('/cms/revisions/'+created.data.revision.id+'/approve',tokens[1],{})).status,201);
 const list=await fetch(web+'/projects',{cache:'no-store'});assert.equal(list.status,200);
 page=await list.text();assert.ok(page.includes('Verified cross-app project'),'CMS publication not reflected in Next.js');
 const detail=await fetch(web+'/projects/'+slug,{cache:'no-store'});assert.equal(detail.status,200,'CMS project detail unavailable');
 assert.ok((await detail.text()).includes('This published information is checked in CI.'));
 assert.equal((await post('/cms/contents/'+contentId+'/archive',tokens[1],{})).status,201);
 const archived=await fetch(web+'/projects/'+slug,{cache:'no-store'});
 assert.equal(archived.status,404,'CMS archived project remained publicly visible');
 console.log('Nisvartha CMS→Next.js approved-only integration, archive and runtime rendering: PASS');
}finally{
 for(const child of [site,app])if(child?.pid){try{process.kill(-child.pid,'SIGTERM')}catch{}await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,3000))]);}
 if(contentId){await db.cmsRevision.deleteMany({where:{contentId}});await db.cmsContent.deleteMany({where:{id:contentId}});}
 await db.staffSession.deleteMany({where:{staffId:{in:staffIds}}});
 await db.cmsAudit.deleteMany({where:{actorId:{in:staffIds}}});
 await db.staffUser.deleteMany({where:{id:{in:staffIds}}});
 await db.$disconnect();
}
