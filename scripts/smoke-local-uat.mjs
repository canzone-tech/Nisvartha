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
 for(const path of ['/admin','/admin/content','/admin/gallery','/admin/enquiries',
  '/admin/members','/admin/staff','/admin/audit','/admin/epin','/admin/recovery']){
  const anonymous=await get(web+path);
  assert.ok([307,308].includes(anonymous.status),'Anonymous Admin route exposed: '+path);
  assert.equal(anonymous.headers.get('location'),'/admin/login');
 }
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
 const homeMarkup=await panel.text();
 assert.match(homeMarkup,/Content workspace/,'Staff CMS workspace not rendered');
 assert.match(homeMarkup,/Workspace navigation/,'Focused admin navigation missing');
 assert.match(homeMarkup,/href="\/admin\/content"/,'Content route missing from sidebar');
 assert.match(homeMarkup,/href="\/admin\/gallery"/,'Gallery route missing from sidebar');
 assert.doesNotMatch(homeMarkup,/href="\/admin\?view=/,'Legacy query nav remains');
 assert.match(homeMarkup,/data-workspace-view="overview"/,'Default admin page must be overview');
 assert.match(homeMarkup,/Make a difference, one update at a time/,
  'Simple Foundation welcome panel missing');
 for(const hidden of ['Create content draft','Media library',
  'Staff accounts','Registration E-PIN policy preview']){
  assert.ok(!homeMarkup.includes(hidden),'ERP-style full-page module leaked onto landing: '+hidden);
 }
 const sections=[
  ['/admin/content','content','Create content draft'],
  ['/admin/gallery','media','Media library'],
  ['/admin/enquiries','enquiries','volunteer enquiries'],
  ['/admin/members','members','Membership applications'],
  ['/admin/staff','staff','Staff accounts'],
  ['/admin/epin','epin','Registration E-PIN policy preview'],
  ['/admin/audit','audit','Recent administrative audit'],
 ];
 for(const [path,view,label] of sections){
  const response=await getWithCookie(web+path,cookie);
  assert.equal(response.status,200,'Admin navigation section failed: '+view);
  const body=await response.text();
  assert.ok(body.includes('data-workspace-view="'+view+'"'),'Wrong active section: '+view);
  assert.ok(body.includes(label),'Expected workspace absent: '+view);
  if(view==='epin'){
   assert.match(body,/type="datetime-local"/,'E-PIN expiry calendar input missing');
   assert.match(body,/Expiry date and time/,'E-PIN picker label missing');
   assert.ok(!body.includes('placeholder="2027-01-31T23:59:00+05:30"'),
    'Old manual ISO date input still rendered');
  }
  if(view!=='content')assert.ok(!body.includes('Create content draft'),
   'CMS editor must not render under '+view);
  if(view!=='media')assert.ok(!body.includes('Media library'),
   'Private image upload must not render under '+view);
 }
 const legacy=await getWithCookie(web+'/admin?view=media',cookie);
 assert.equal(legacy.status,307,'Old gallery bookmark should redirect');
 assert.equal(legacy.headers.get('location'),'/admin/gallery');
 const unexpected=await getWithCookie(web+'/admin?view=not-a-workspace',cookie);
 assert.match(await unexpected.text(),/data-workspace-view="overview"/,
  'Unknown view must fail closed to safe overview');

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
