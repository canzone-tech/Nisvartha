import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {parseEnv} from 'node:util';
import {execFileSync,spawn} from 'node:child_process';

const [rootInput,apiFile,webFile]=process.argv.slice(2);
if(!rootInput||!apiFile||!webFile)throw Error('Staging smoke requires compiled artifact and protected candidate env files');
const root=resolve(rootInput);
const api=parseEnv(readFileSync(apiFile,'utf8'));
const web=parseEnv(readFileSync(webFile,'utf8'));
const uid=Number(execFileSync('id',['-u','nisvartha'],{encoding:'utf8'}).trim());
const gid=Number(execFileSync('id',['-g','nisvartha'],{encoding:'utf8'}).trim());
const processes=[];
const base='http://127.0.0.1:3114';
const apiBase='http://127.0.0.1:3115';
function launch(file,cwd,config){
 const child=spawn(process.execPath,[file],{cwd,uid,gid,env:{...process.env,...config},stdio:'ignore'});
 processes.push(child);return child;
}
async function ready(url,child){
 for(let i=0;i<50;i++){
  if(child.exitCode!==null)throw Error('Staged compiled process exited');
  try{if((await fetch(url,{signal:AbortSignal.timeout(800)})).status===200)return}catch{}
  await new Promise(ok=>setTimeout(ok,250));
 }
 throw Error('Staged compiled process failed health probe');
}
try{
 const backend=launch(join(root,'api/dist/main.js'),join(root,'api'),{
  ...api,NODE_ENV:'production',HOST:'127.0.0.1',PORT:'3115'
 });
 await ready(apiBase+'/api/v1/health/ready',backend);
 const frontend=launch(join(root,'web/server.js'),join(root,'web'),{
  ...web,NODE_ENV:'production',HOSTNAME:'127.0.0.1',PORT:'3114',
  API_INTERNAL_URL:apiBase
 });
 await ready(base+'/',frontend);
 for(const path of ['/','/member/login','/admin/login','/auto-pool-plan']){
  const response=await fetch(base+path,{redirect:'manual'});
  assert.equal(response.status,200,'Staged compiled route not available: '+path);
  }
 for(const path of [base+'/member/register',base+'/api/member/session/register',apiBase+'/api/v1/members/register']){
  const response=await fetch(path,path.endsWith('/register')&&path.includes('/api/')?
   {method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:'{}'}:
   {redirect:'manual'});
  assert.equal(response.status,404,'Public member registration must remain closed: '+path);
 }
 const member=await fetch(base+'/member',{redirect:'manual'});
 assert.ok([307,308].includes(member.status),'Anonymous member dashboard must redirect');
 assert.equal(member.headers.get('location'),'/member/login');
 assert.equal((await fetch(apiBase+'/api/v1/members/me')).status,401,
  'Anonymous member API access must be denied');
 assert.equal((await fetch(base+'/api/admin/backend/staff/me')).status,401,
  'Anonymous Admin BFF access must be denied');
 console.log('Isolated compiled full-stack member/Admin staging smoke: PASS');
}finally{
 for(const child of processes){
  if(!child?.pid||child.exitCode!==null)continue;
  const stopped=new Promise(resolve=>child.once('exit',resolve));
  child.kill('SIGTERM');
  await Promise.race([stopped,new Promise(ok=>setTimeout(ok,2500))]);
  if(child.exitCode===null)child.kill('SIGKILL');
 }
}
