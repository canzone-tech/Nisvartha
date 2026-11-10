import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {smokeDeployedRelease} from './smoke-deployed-release.mjs';

// In-memory localhost server only: no production network, writes or credentials.
let memberPortal=false,memberRegistration=false,memberIndexable=false;
let missingPin=false,missingInvite=false,exposedMemberMe=false,badMemberRedirect=false;
let poolMode='informational',breakReady=false,breakPrivate=false,publicApproved=false;
const privateHtml=(heading,inputs='')=>
 '<!doctype html><html><head><meta name="robots" content="'+
 (memberIndexable?'index, follow':'noindex, nofollow')+
 '"></head><body><main><h1>'+heading+'</h1><form>'+inputs+'</form></main></body></html>';
const input=name=>'<input name="'+name+'">';

const server=createServer((req,res)=>{
 const path=new URL(req.url,'http://127.0.0.1').pathname;
 const status=(code,body,headers={})=>{res.writeHead(code,headers);res.end(body)};
 if(path==='/api/v1/health/live'||path==='/api/v1/health/ready'){
  if(breakReady&&path.endsWith('ready'))return status(503,'{"message":"Unavailable"}');
  return status(200,'{"status":"ok"}',{'Content-Type':'application/json'});
 }
 if(path==='/api/v1/members/me')
  return status(exposedMemberMe?200:401,exposedMemberMe?'{"email":"exposed"}':'{"message":"Unauthorized"}');
 if(path==='/api/admin/backend/staff/me')
  return status(breakPrivate?200:401,'{"message":"Unauthorized"}');
 if(path==='/admin')
  return status(307,'',{'Location':'/admin/login'});
 if(path==='/admin/login')
  return status(200,privateHtml('Admin sign in',input('email')+input('password')));
 if(path==='/auto-pool-plan'){
  if(poolMode==='missing')return status(404,'Not found');
  const robots=poolMode==='noRobots'?'':'<meta name="robots" content="noindex, nofollow">';
  const notice=poolMode==='noNotice'?'No enrolment statement here.':
   'Public enrolment is not processed on this page.';
  return status(200,'<!doctype html><html><head>'+robots+
   '</head><body><p>'+notice+'</p></body></html>',{'Content-Type':'text/html'});
 }
 if(path==='/member/login'){
  if(!memberPortal)return status(404,'Not found');
  return status(200,privateHtml('Member sign in',input('identifier')+input('password')));
 }
 if(path==='/member/register'){
  if(!memberRegistration)return status(404,'Not found');
  return status(200,privateHtml('Membership registration',
   '<p>Register with your E-PIN and referral code to activate membership.</p>'+
   input('email')+input('displayName')+input('password')+
   (missingPin?'':input('registrationPin'))+(missingInvite?'':input('inviteCode'))));
 }
 if(path==='/member')
  return memberPortal?status(307,'',{'Location':badMemberRedirect?'/admin/login':'/member/login'}):
   status(404,'Not found');
 if(path==='/robots.txt')
  return status(200,publicApproved?
   'User-agent: *\nAllow: /\nDisallow: /auto-pool-plan\nSitemap: https://example.invalid/sitemap.xml\n':
   'User-agent: *\nDisallow: /\n',{'Content-Type':'text/plain'});
 if(['/','/about','/projects','/go-green','/contact'].includes(path))
  return status(200,'<!doctype html><h1>Nisvartha synthetic smoke test page</h1>');
 return status(404,'Not found');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port;
const held={allowLoopback:true,expectMemberDisabled:true,
 expectMemberRegistrationEnabled:false,expectNoIndex:true};
const operational={...held,expectMemberDisabled:false,expectMemberRegistrationEnabled:true,
 expectRegistrationPinEnabled:true,expectImmediateActivation:true};
const fails=async(label,options)=>assert.rejects(
 smokeDeployedRelease(url,options),Error,label
);
try{
 const defaultSmoke=await smokeDeployedRelease(url,held);
 assert.equal(defaultSmoke.origin,url);
 assert.equal(defaultSmoke.checks,15);

 breakReady=true;await fails('A readiness outage must block release',held);breakReady=false;
 breakPrivate=true;await fails('Public staff BFF exposure must block release',held);breakPrivate=false;
 poolMode='missing';await fails('Informational Auto Pool page missing',held);poolMode='informational';
 poolMode='noRobots';await fails('Auto Pool page lost its noindex',held);poolMode='informational';
 poolMode='noNotice';await fails('Auto Pool enrolment disclosure missing',held);poolMode='informational';

 memberPortal=true;
 await fails('Member login unexpectedly enabled in default-off release',held);
 memberPortal=false;memberRegistration=true;
 await fails('Unapproved member registration must block release',held);

 // A configured release must prove login, PIN signup, anonymous denial and
 // page-level privacy on the deployed origin, not merely skip a 404 check.
 memberPortal=true;
 assert.equal((await smokeDeployedRelease(url,operational)).checks,16);
 memberPortal=false;await fails('Missing operational member portal must fail',operational);
 memberPortal=true;memberRegistration=false;
 await fails('Missing operational registration must fail',operational);
 memberRegistration=true;missingPin=true;
 await fails('Missing PIN field in operational signup must fail',operational);
 missingPin=false;missingInvite=true;
 await fails('Missing inviter field must fail',operational);
 missingInvite=false;memberIndexable=true;
 await fails('Indexable member account pages must fail',operational);
 memberIndexable=false;exposedMemberMe=true;
 await fails('Member profile API exposure must fail',operational);
 exposedMemberMe=false;badMemberRedirect=true;
 await fails('Misrouted anonymous dashboard must fail',operational);
 badMemberRedirect=false;

 // An approved login-only portal cannot be confused with registration mode.
 memberRegistration=false;
 const loginOnly={...operational,expectMemberRegistrationEnabled:false,
  expectRegistrationPinEnabled:false,expectImmediateActivation:false};
 assert.equal((await smokeDeployedRelease(url,loginOnly)).checks,16);
 await fails('Portal enabled without registration must fail closed if auto-PIN is expected',
  {...loginOnly,expectImmediateActivation:true});
 memberPortal=false;
 assert.equal((await smokeDeployedRelease(url,held)).checks,15);

 // Crawling must follow content approval, never an untrusted smoke override.
 publicApproved=true;
 assert.equal((await smokeDeployedRelease(url,{...held,expectNoIndex:false})).checks,15);
 await fails('Approved-site robots and pending-site expectations must not drift',held);

 await fails('Public plaintext HTTP must be rejected',
  {...held,allowLoopback:false});
 await assert.rejects(smokeDeployedRelease('http://example.com'),Error,
  'Remote plaintext HTTP must be rejected');
 await assert.rejects(smokeDeployedRelease('https://user:password@example.org'),Error,
  'Origin containing embedded credentials must be rejected');
 console.log('M7 read-only deployed-origin release gate: held/active/login-only modes, privacy, RBAC, PIN/referral UI, health, SEO and HTTPS: PASS');
}finally{
 await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
}
