import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

// Local manual-UAT smoke only. No external origin or production credential.
// The only mutation is a synthetic staff login/session in the disposable DB.
const loopback=(value)=>{
 let url;
 try{url=new URL(value||'')}catch{throw Error('Local UAT requires valid loopback HTTP origins')}
 if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||
    url.username||url.password||url.pathname!=='/'||url.search||url.hash)
  throw Error('Local UAT refuses public, credential-bearing or non-HTTP origins');
 return url.origin;
};
const get=(url)=>fetch(url,{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(8000)});

export async function smokeLocalUat(webOrigin,apiOrigin,email,password){
 const web=loopback(webOrigin),api=loopback(apiOrigin);
 assert.ok(web!==api,'Local web/API must use distinct loopback origins');
 assert.ok(typeof email==='string'&&email.endsWith('@example.invalid'),
  'Local synthetic staff identity required');
 assert.ok(typeof password==='string'&&password.length>=14,
  'Local synthetic credential required');
 const ready=await get(api+'/api/v1/health/ready');
 assert.equal(ready.status,200,'Compiled API failed MySQL readiness');
 assert.equal((await ready.json()).status,'ok','Unexpected API readiness response');
 for(const path of ['/','/about','/projects','/go-green','/contact','/admin/login']){
  const response=await get(web+path);
  assert.equal(response.status,200,'Local compiled frontend route unavailable: '+path);
 }
 const robots=await get(web+'/robots.txt');
 assert.equal(robots.status,200);
 assert.match(await robots.text(),/Disallow:\s*\//i,'Local content must remain noindex');
 assert.equal((await get(web+'/auto-pool-plan')).status,404,'Financial plan exposed locally');
 assert.equal((await get(web+'/member/register')).status,404,'Member registration enabled in local UAT');
 assert.equal((await get(web+'/api/admin/backend/staff/me')).status,401,
  'Anonymous staff data exposed');
 const anonymous=await get(web+'/admin');
 assert.ok([307,308].includes(anonymous.status),'Unauthenticated admin route not protected');
 const login=await fetch(web+'/api/admin/session/login',{
  method:'POST',cache:'no-store',redirect:'manual',
  headers:{Origin:web,'Content-Type':'application/json'},
  body:JSON.stringify({email,password}),signal:AbortSignal.timeout(8000)
 });
 assert.equal(login.status,200,'Synthetic staff login through browser BFF failed');
 const setCookie=login.headers.get('set-cookie')||'';
 assert.match(setCookie,/nisvartha_staff_access=/,'Missing staff session cookie');
 assert.match(setCookie,/httponly/i,'Staff session must be HttpOnly');
 assert.match(setCookie,/samesite=strict/i,'Staff session must be SameSite Strict');
 const cookie=setCookie.split(';')[0];
 const me=await getWithCookie(web+'/api/admin/backend/staff/me',cookie);
 assert.equal(me.status,200,'Authenticated staff BFF unavailable');
 const account=await me.json();
 assert.equal(account.email,email,'Staff session authenticated wrong account');
 const panel=await getWithCookie(web+'/admin',cookie);
 assert.equal(panel.status,200,'Authenticated staff workspace unavailable');
 assert.match(await panel.text(),/Content workspace/,'Staff CMS workspace not rendered');
 return {web,api,passed:true};
}
function getWithCookie(url,cookie){
 return fetch(url,{headers:{Cookie:cookie},cache:'no-store',
  redirect:'manual',signal:AbortSignal.timeout(8000)});
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 try{
  const result=await smokeLocalUat(
   process.env.NISVARTHA_UAT_WEB_ORIGIN,
   process.env.NISVARTHA_UAT_API_ORIGIN,
   process.env.NISVARTHA_UAT_STAFF_EMAIL,
   process.env.NISVARTHA_UAT_STAFF_PASSWORD
  );
  console.log('Nisvartha local compiled web/API + synthetic staff CMS BFF UAT: PASS ('+result.web+')');
 }catch(error){
  console.error('Nisvartha local UAT smoke failed: '+
   (error instanceof Error?error.message:'Unknown failure'));
  process.exitCode=1;
 }
}
