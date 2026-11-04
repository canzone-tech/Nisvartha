import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {readFileSync} from 'node:fs';
import {brotliDecompressSync} from 'node:zlib';
import {wireMemberLinks} from './client-link-adapter.mjs';
const archive=Buffer.from([1,2,3].map(n=>readFileSync(
 new URL('../frontend/vendor/client-bundle-v1.1.part'+n+'.txt',import.meta.url),'utf8'
)).join(''),'base64');
const bundle=JSON.parse(brotliDecompressSync(archive).toString('utf8'));
const port=await new Promise((resolve,reject)=>{
 const server=createServer();server.once('error',reject);
 server.listen(0,'127.0.0.1',()=>{
  const address=server.address();
  if(!address||typeof address==='string')return reject(new Error('Port unavailable'));
  server.close(()=>resolve(address.port));
 });
});
const base='http://127.0.0.1:'+port;
const app=spawn('npm',['--prefix','frontend','run','start','--','-p',String(port)],{
 stdio:'ignore',detached:true,
 env:{...process.env,NISVARTHA_CLIENT_TEMPLATE_PREVIEW:'true',
  NEXT_PUBLIC_SITE_URL:'http://127.0.0.1:3102',PUBLIC_CONTENT_APPROVED:'false'}
});
try{
 let started=false;
 for(let n=0;n<50;n++){
  try{if((await fetch(base+'/')).ok){started=true;break}}catch{}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 assert.ok(started,'Exact client preview did not boot');
 for(const [name,html] of Object.entries(bundle)){
  if(!name.endsWith('.html'))continue;
  const slug=name.slice(0,-5),route=slug==='index'?'/':'/'+slug;
  const response=await fetch(base+route);
  assert.equal(response.status,200,route+' not available');
  assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow',
   route+' must remain noindex');
  assert.equal(await response.text(),wireMemberLinks(html),'Client visible content/design/approved link mapping changed: '+name);
  const oldStyle=await fetch(base+'/'+name);
  assert.equal(await oldStyle.text(),wireMemberLinks(html),'Original .html deep link differs: '+name);
 }
 for(const [asset,path] of [['styles.css','assets/styles.css'],['site.js','assets/site.js']]){
  const res=await fetch(base+'/assets/'+asset);
  assert.equal(res.status,200,'Missing client asset '+asset);
  assert.equal(await res.text(),bundle[path],'Source asset changed: '+asset);
 }
 for(const route of ['/admin','/admin/members']){
  const res=await fetch(base+route,{redirect:'manual'});
  assert.equal(res.status,307,'Prototype altered staff auth: '+route);
 }
 for(const route of ['/member/login','/member/register']){
  const res=await fetch(base+route,{redirect:'manual'});
  assert.equal(res.status,404,'Prototype accidentally enabled member gate: '+route);
 }
 assert.equal((await fetch(base+'/api/admin/backend/cms/contents')).status,401,
  'Prototype bypassed private Admin BFF');
 console.log('Exact client HTML/copy on 18 routes, CSS/JS, noindex and unaffected private routes: PASS');
}finally{
 try{process.kill(-app.pid,'SIGTERM')}catch{}
}
