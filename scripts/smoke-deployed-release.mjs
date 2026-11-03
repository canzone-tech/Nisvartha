/**
 * Read-only deployed release smoke. Probes real public/web API origins and
 * rejects unexpected exposure of staff and withheld financial routes.
 * Never sends credentials, posts forms, writes data or deploys code.
 */
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

function origin(value,allowLoopback){
 let url;
 try{url=new URL(value)}catch{throw Error('SMOKE_WEB_ORIGIN must be a valid origin')}
 const loop=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
 if(!url.hostname||url.username||url.password||url.pathname!=='/'||
    url.search||url.hash||
    (url.protocol!=='https:'&&!(allowLoopback&&loop&&url.protocol==='http:')))
  throw Error('Smoke requires HTTPS public origin (HTTP only for isolated localhost regression tests)');
 return url.origin;
}
const request=async(base,path)=>{
 const response=await fetch(base+path,{
  method:'GET',redirect:'manual',cache:'no-store',
  headers:{Accept:'text/html,application/json,text/plain'},
  signal:AbortSignal.timeout(8000)
 });
 return response;
};
export async function smokeDeployedRelease(baseUrl,{
 allowLoopback=false,expectMemberDisabled=true,expectNoIndex=true
}={}){
 const base=origin(baseUrl,allowLoopback);
 const checks=[
  ['/','public homepage'],['/about','about'],['/projects','projects'],
  ['/go-green','Go Green'],['/contact','contact'],['/robots.txt','robots']
 ];
 for(const [path,label] of checks){
  const response=await request(base,path);
  assert.equal(response.status,200,label+' failed on deployed origin');
  const body=await response.text();
  assert.ok(body.trim().length>20,label+' was empty');
  if(path==='/robots.txt'&&expectNoIndex)
   assert.match(body,/Disallow:\s*\//i,'Pending content must not be indexed');
 }
 for(const [path,label] of [
  ['/api/v1/health/live','API liveness'],
  ['/api/v1/health/ready','API MySQL readiness']
 ]){
  const response=await request(base,path);
  assert.equal(response.status,200,label+' failed behind public reverse proxy');
  const body=await response.json();
  assert.equal(body.status,'ok',label+' unexpected payload');
 }
 const held=await request(base,'/auto-pool-plan');
 assert.equal(held.status,404,'Unapproved matrix plan unexpectedly public');
 const anonymous=await request(base,'/api/admin/backend/staff/me');
 assert.equal(anonymous.status,401,'Anonymous staff BFF was not denied');
 const admin=await request(base,'/admin');
 assert.ok([307,308].includes(admin.status),
  'Anonymous staff workspace should redirect to login');
 const location=admin.headers.get('location')||'';
 assert.ok(location==='/admin/login'||location===base+'/admin/login',
  'Staff auth redirect target unexpected');
 if(expectMemberDisabled){
  const member=await request(base,'/member/register');
  assert.equal(member.status,404,'Unapproved member registration unexpectedly enabled');
 }
 return {origin:base,checks:checks.length+5+(expectMemberDisabled?1:0)};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const url=process.env.SMOKE_WEB_ORIGIN;
 if(!url){console.error('SMOKE_WEB_ORIGIN required; no deployed site tested');process.exitCode=2}
 else{
  try{
   const held=process.env.SMOKE_EXPECT_MEMBER_DISABLED!=='false';
   const noIndex=process.env.SMOKE_EXPECT_NO_INDEX!=='false';
   const result=await smokeDeployedRelease(url,{expectMemberDisabled:held,expectNoIndex:noIndex});
   console.log('Nisvartha public release smoke: PASS ('+result.checks+
    ' read-only checks at '+result.origin+')');
  }catch(error){
   console.error('Nisvartha public release smoke failed: '+
    (error instanceof Error?error.message:'Unknown failure'));
   process.exitCode=1;
  }
 }
}
