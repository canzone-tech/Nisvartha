/**
 * Read-only deployed release smoke. Probes real public/web API origins and
 * rejects unexpected exposure of staff and withheld financial routes.
 * Never sends credentials, posts forms, writes data or deploys code.
 */
import assert from 'node:assert/strict';
import {assertAutoPoolInformationalRoute} from './auto-pool-contract.mjs';
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
const checkNoIndex=(html,label)=>{
 assert.match(html,/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i,
  label+' must carry a page-level robots noindex meta tag');
};
const page=async(base,path,label,expectedFields=[])=>{
 const response=await request(base,path);
 assert.equal(response.status,200,label+' must be available');
 const html=await response.text();
 checkNoIndex(html,label);
 assert.match(html,/<main\b/i,label+' missing main landmark');
 for(const name of expectedFields)
  assert.match(html,new RegExp('name=["\x27]'+name+'["\x27]'),label+' missing '+name+' control');
 return html;
};
export async function smokeDeployedRelease(baseUrl,{
 allowLoopback=false,expectMemberDisabled=true,expectNoIndex=true,
 expectMemberRegistrationEnabled=!expectMemberDisabled,
 expectRegistrationPinEnabled=false,expectImmediateActivation=false
}={}){
 const base=origin(baseUrl,allowLoopback);
 let homepageHtml='';
 const checks=[
  ['/','public homepage'],['/about','about'],['/projects','projects'],
  ['/go-green','Go Green'],['/contact','contact'],['/robots.txt','robots']
 ];
 for(const [path,label] of checks){
  const response=await request(base,path);
  assert.equal(response.status,200,label+' failed on deployed origin');
  const body=await response.text();
  assert.ok(body.trim().length>20,label+' was empty');
  if(path==='/')homepageHtml=body;
  if(path==='/robots.txt'){
   if(expectNoIndex)
    assert.match(body,/^Disallow:\s*\/\s*$/im,'Pending content must not be indexed');
   else{
    assert.match(body,/^Allow:\s*\/\s*$/im,'Approved public content must be crawlable');
    assert.doesNotMatch(body,/^Disallow:\s*\/\s*$/im,'Approved site has a blanket crawl block');
   }
  }
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
 const pool=await request(base,'/auto-pool-plan');
 assertAutoPoolInformationalRoute(pool.status,await pool.text(),'Deployed Auto Pool');
 const anonymous=await request(base,'/api/admin/backend/staff/me');
 assert.equal(anonymous.status,401,'Anonymous staff BFF was not denied');
 const admin=await request(base,'/admin');
 assert.ok([307,308].includes(admin.status),
  'Anonymous staff workspace should redirect to login');
 const location=admin.headers.get('location')||'';
 assert.ok(location==='/admin/login'||location===base+'/admin/login',
  'Staff auth redirect target unexpected');
 await page(base,'/admin/login','Admin sign-in',['email','password']);
 const portalEnabled=!expectMemberDisabled;
 const navigation=/<nav[^>]*aria-label=["']Primary navigation["'][^>]*>([\s\S]*?)<\/nav>/i.exec(homepageHtml)?.[1];
 assert.notEqual(navigation,undefined,'Homepage primary navigation missing');
 for(const [enabled,path] of [[portalEnabled,'/member/login'],[expectMemberRegistrationEnabled,'/member/register']]){
  const link=new RegExp('href=["\\x27]'+path.replaceAll('/','\\/')+'["\\x27]');
  if(enabled)assert.match(navigation,link,'Enabled member route missing from public navigation: '+path);
  else assert.doesNotMatch(navigation,link,'Disabled member route advertised in public navigation: '+path);
 }
 if(expectMemberRegistrationEnabled&&!portalEnabled)
  throw Error('Registration cannot be expected when member portal is disabled');
 if(expectImmediateActivation&&(!portalEnabled||!expectMemberRegistrationEnabled||!expectRegistrationPinEnabled))
  throw Error('Immediate E-PIN activation requires enabled portal, signup and PIN fields');
 if(portalEnabled){
  await page(base,'/member/login','Member sign-in',['identifier','password']);
  const dashboard=await request(base,'/member');
  assert.ok([307,308].includes(dashboard.status),
   'Anonymous member dashboard must redirect to sign-in');
  const redirect=dashboard.headers.get('location')||'';
  assert.ok(redirect==='/member/login'||redirect===base+'/member/login',
   'Anonymous member dashboard redirected to an unexpected location');
  const me=await request(base,'/api/v1/members/me');
  assert.equal(me.status,401,'Anonymous member profile API must not expose member data');
 }else{
  for(const path of ['/member/login','/member']){
   const disabled=await request(base,path);
   assert.equal(disabled.status,404,'Member portal unexpectedly accessible: '+path);
  }
 }
 if(expectMemberRegistrationEnabled){
  const html=await page(base,'/member/register','Member registration',
   ['email','displayName','password',...(expectRegistrationPinEnabled?['registrationPin']:[])]);
  if(expectImmediateActivation){
   assert.match(html,/name=["']inviteCode["']/i,'Active registration missing referral code');
   assert.match(html,/Register with your E-PIN and referral code/i,
    'Active registration displays outdated review instructions');
   assert.doesNotMatch(html,/Membership activation follows registration review/i,
    'Client-facing registration still asks for a second membership approval');
  }
 }else{
  const disabled=await request(base,'/member/register');
  assert.equal(disabled.status,404,'Member registration unexpectedly accessible');
 }
 return {origin:base,checks:checks.length+9+(portalEnabled?1:0)};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const url=process.env.SMOKE_WEB_ORIGIN;
 if(!url){console.error('SMOKE_WEB_ORIGIN required; no deployed site tested');process.exitCode=2}
 else{
  try{
   const held=process.env.SMOKE_EXPECT_MEMBER_DISABLED!=='false';
   const noIndex=process.env.SMOKE_EXPECT_NO_INDEX!=='false';
   const result=await smokeDeployedRelease(url,{
    expectMemberDisabled:held,expectNoIndex:noIndex,
    expectMemberRegistrationEnabled:process.env.SMOKE_EXPECT_MEMBER_REGISTRATION_ENABLED==='true',
    expectRegistrationPinEnabled:process.env.SMOKE_EXPECT_REGISTRATION_PIN_ENABLED==='true',
    expectImmediateActivation:process.env.SMOKE_EXPECT_PIN_AUTO_ACTIVATE_ENABLED==='true'
   });
   console.log('Nisvartha public release smoke: PASS ('+result.checks+
    ' read-only checks at '+result.origin+')');
  }catch(error){
   console.error('Nisvartha public release smoke failed: '+
    (error instanceof Error?error.message:'Unknown failure'));
   process.exitCode=1;
  }
 }
}
