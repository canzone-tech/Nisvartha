import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

// Synthetic local UAT only: exercises the ACTUAL staff API for independent CMS
// reviewer provisioning. Never writes to production, prints tokens or creates
// a privileged SUPER_ADMIN. The caller must use a disposable localhost DB.
export async function provisionLocalUatApprover({
 apiOrigin,webOrigin,adminEmail,adminPassword,approverEmail,approverPassword
}){
 const local=(value)=>{
  const u=new URL(value||'');
  if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||
     u.username||u.password||u.pathname!=='/'||u.search||u.hash)
   throw Error('Local UAT provisioning requires a 127.0.0.1 HTTP origin');
  return u.origin;
 };
 const api=local(apiOrigin),web=local(webOrigin);
 assert.notEqual(api,web,'Backend and browser UAT origins must be separate');
 for(const email of [adminEmail,approverEmail]){
  assert.ok(typeof email==='string'&&email.endsWith('@example.invalid'),
   'Synthetic staff identity required');
 }
 for(const secret of [adminPassword,approverPassword]){
  assert.ok(typeof secret==='string'&&secret.length>=14,
   'Synthetic password required');
 }
 assert.notEqual(adminEmail,approverEmail);
 const login=await fetch(api+'/api/v1/staff/login',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({email:adminEmail,password:adminPassword}),
  signal:AbortSignal.timeout(8000)
 });
 assert.equal(login.status,200,'Local Admin login failed before reviewer provisioning');
 const data=await login.json();
 assert.ok(typeof data.accessToken==='string'&&data.accessToken.length>=32,
  'Local Admin API session missing');
 const created=await fetch(api+'/api/v1/staff/accounts',{
  method:'POST',headers:{
   'Content-Type':'application/json',Authorization:'Bearer '+data.accessToken
  },body:JSON.stringify({email:approverEmail,
   displayName:'Local UAT Independent Approver',password:approverPassword,role:'APPROVER'}),
  signal:AbortSignal.timeout(8000)
 });
 assert.equal(created.status,201,'Independent synthetic Approver creation denied');
 const reviewer=await created.json();
 assert.equal(reviewer.role,'APPROVER','Local reviewer must never become privileged ADMIN');
 assert.equal(reviewer.email,approverEmail,'Local reviewer identity mismatch');
 const browserLogin=await fetch(web+'/api/admin/session/login',{
  method:'POST',
  headers:{Origin:web,'Content-Type':'application/json'},
  body:JSON.stringify({email:approverEmail,password:approverPassword}),
  signal:AbortSignal.timeout(8000)
 });
 assert.equal(browserLogin.status,200,'Independent approver cannot sign into browser CMS');
 const cookie=(browserLogin.headers.get('set-cookie')||'').split(';')[0];
 assert.match(cookie,/nisvartha_staff_access=/,'Reviewer cookie missing');
 const denied=await fetch(web+'/api/admin/backend/staff/accounts',{
  headers:{Cookie:cookie},cache:'no-store',signal:AbortSignal.timeout(8000)
 });
 assert.equal(denied.status,403,'APPROVER must not administer staff accounts');
 return {email:approverEmail,role:'APPROVER'};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 try{
  await provisionLocalUatApprover({
   apiOrigin:process.env.NISVARTHA_UAT_API_ORIGIN,
   webOrigin:process.env.NISVARTHA_UAT_WEB_ORIGIN,
   adminEmail:process.env.NISVARTHA_UAT_STAFF_EMAIL,
   adminPassword:process.env.NISVARTHA_UAT_STAFF_PASSWORD,
   approverEmail:process.env.NISVARTHA_UAT_APPROVER_EMAIL,
   approverPassword:process.env.NISVARTHA_UAT_APPROVER_PASSWORD
  });
  console.log('Nisvartha local synthetic independent CMS approver role and BFF RBAC: PASS');
 }catch(error){
  console.error('Nisvartha local UAT approver provisioning failed: '+
   (error instanceof Error?error.message:'Unknown failure'));
  process.exitCode=1;
 }
}
