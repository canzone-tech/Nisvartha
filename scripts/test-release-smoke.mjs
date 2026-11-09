import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {smokeDeployedRelease} from './smoke-deployed-release.mjs';

let allowedMember=false,poolMode='informational',breakReady=false,breakPrivate=false;
const server=createServer((req,res)=>{
 const path=new URL(req.url,'http://127.0.0.1').pathname;
 const status=(code,text,headers={})=>{res.writeHead(code,headers);res.end(text)};
 if(path==='/api/v1/health/live'||path==='/api/v1/health/ready'){
  if(breakReady&&path.endsWith('ready'))return status(503,'{"message":"Unavailable"}');
  return status(200,'{"status":"ok"}',{'Content-Type':'application/json'});
 }
 if(path==='/api/admin/backend/staff/me')
  return status(breakPrivate?200:401,'{"message":"Unauthorized"}');
 if(path==='/admin')
  return status(307,'',{'Location':'/admin/login'});
 if(path==='/auto-pool-plan'){
  if(poolMode==='missing')return status(404,'Not found');
  const robots=poolMode==='noRobots'?'':'<meta name="robots" content="noindex, nofollow">';
  const notice=poolMode==='noNotice'?'No enrolment statement here.':
   'Public enrolment is not processed on this page.';
  return status(200,'<!doctype html><html><head>'+robots+
   '</head><body><p>'+notice+'</p></body></html>',{'Content-Type':'text/html'});
 }
 if(path==='/member/register')
  return status(allowedMember?200:404,'Not found');
 if(path==='/robots.txt')
  return status(200,'User-agent: *\nDisallow: /\n',{'Content-Type':'text/plain'});
 if(['/','/about','/projects','/go-green','/contact'].includes(path))
  return status(200,'<!doctype html><h1>Nisvartha synthetic smoke test page</h1>');
 return status(404,'Not found');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port;
const expected={allowLoopback:true,expectMemberDisabled:true,expectNoIndex:true};
try{
 const result=await smokeDeployedRelease(url,expected);
 assert.equal(result.origin,url);
 assert.equal(result.checks,12);
 const shouldFail=async(label)=>{
  await assert.rejects(smokeDeployedRelease(url,expected),Error,label);
 };
 breakReady=true;await shouldFail('Readiness outage must block release');breakReady=false;
 breakPrivate=true;await shouldFail('Public staff BFF exposure must block release');breakPrivate=false;
 publicMatrix=true;await shouldFail('Unapproved matrix plan must block release');publicMatrix=false;
 allowedMember=true;await shouldFail('Unapproved registration must block release');allowedMember=false;
 const permitted=await smokeDeployedRelease(url,{...expected,expectMemberDisabled:false});
 assert.equal(permitted.checks,11);
 await assert.rejects(smokeDeployedRelease('http://example.com'),Error,
  'Public plaintext HTTP must be rejected');
 await assert.rejects(smokeDeployedRelease('http://127.0.0.1:3102'),Error,
  'Local HTTP must require explicit test-mode exemption');
 await assert.rejects(smokeDeployedRelease('https://user:password@example.org'),Error,
  'Origin with embedded credentials must be rejected');
 console.log('Nisvartha deployed-origin smoke regression: routes, API readiness, RBAC privacy, held-plan/member boundaries and HTTPS PASS');
}finally{
 await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
}
