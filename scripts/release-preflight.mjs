/**
 * Non-mutating production-config preflight for the existing self-hosted
 * Next.js + loopback NestJS + MySQL deployment posture.
 *
 * Use on the actual runtime host with its real environment. It never reads
 * files, connects to a DB, prints credentials, deploys or changes state.
 * This is a technical guard, not evidence of Foundation/legal approval.
 */
import {fileURLToPath} from 'node:url';
import {resolve,isAbsolute} from 'node:path';

const flag=(env,key)=>env[key]==='true';
const configuredFlag=(env,key)=>env[key]==='true'||env[key]==='false';
const bad=(fail,message)=>fail.push(message);
const httpsUrl=(value,fail,key)=>{
 try{
  const u=new URL(value||'');
  if(u.protocol!=='https:'||!u.hostname||u.username||u.password||
     u.search||u.hash||u.pathname!=='/'||
     ['localhost','127.0.0.1','0.0.0.0','::1','[::1]'].includes(u.hostname.toLowerCase())){
   bad(fail,key+' must be a public HTTPS origin without credentials or path');
   return null;
  }
  return u;
 }catch{
  bad(fail,key+' must be a public HTTPS origin without credentials or path');
  return null;
 }
};
const strictBoolean=(env,fail,...keys)=>{
 for(const key of keys)if(!configuredFlag(env,key))
  bad(fail,key+' must be explicitly true or false');
};

export function validateReleaseConfiguration(env,component){
 const fail=[];
 // UAT credentials are never allowed on a real host, even with explicit config.
 if(env.NISVARTHA_UAT_PIN_REGISTRATION&&env.NISVARTHA_UAT_PIN_REGISTRATION!=='false')
  bad(fail,'Synthetic PIN signup is prohibited in production');
 if(env.NISVARTHA_CLIENT_TEMPLATE_PREVIEW&&env.NISVARTHA_CLIENT_TEMPLATE_PREVIEW!=='false')
  bad(fail,'Unapproved static client HTML prototype is prohibited in production');
 if(env.NISVARTHA_UAT_PLAN&&env.NISVARTHA_UAT_PLAN!=='off'&&env.NISVARTHA_UAT_PLAN!=='false')
  bad(fail,'Synthetic Auto Pool Plan review is prohibited in production');
 for(const key of ['NISVARTHA_UAT_FORMS','NISVARTHA_UAT_MEMBERS','NISVARTHA_UAT_PIN_FLOW']){
  if(env[key]&&env[key]!=='off'&&env[key]!=='false')
   bad(fail,'Synthetic local UAT mode is prohibited in production: '+key);
 }
 if(env.MEMBER_WALLET_ENABLED&&!configuredFlag(env,'MEMBER_WALLET_ENABLED'))
  bad(fail,'MEMBER_WALLET_ENABLED must be explicitly true or false');
 if(flag(env,'MEMBER_WALLET_ENABLED')&&!flag(env,'MEMBER_PORTAL_ENABLED'))
  bad(fail,'Member wallet requires the authenticated member portal');
 if(env.MEMBER_PIN_AUTO_ACTIVATE_ENABLED&&!configuredFlag(env,'MEMBER_PIN_AUTO_ACTIVATE_ENABLED'))
  bad(fail,'MEMBER_PIN_AUTO_ACTIVATE_ENABLED must be explicitly true or false');
 if(flag(env,'MEMBER_PIN_AUTO_ACTIVATE_ENABLED')&&
    (!flag(env,'REGISTRATION_ACCESS_PIN_ENABLED')||
     !flag(env,'MATRIX_PLACEMENT_ENABLED')||
     !flag(env,'MEMBER_PORTAL_ENABLED')||
     !flag(env,'MEMBER_APPLICATIONS_ENABLED')||
     !flag(env,'MEMBER_STAFF_REGISTRATION_ENABLED')||
     flag(env,'MEMBER_COMPENSATION_ENABLED')))
  bad(fail,'Immediate E-PIN activation requires registration, matrix and member access with compensation disabled');
 for(const key of ['REGISTRATION_ACCESS_PIN_ENABLED','MATRIX_PLACEMENT_ENABLED','MEMBER_COMPENSATION_ENABLED'])
  if(env[key]&&!configuredFlag(env,key))
   bad(fail,key+' must be explicitly true or false');
 if(flag(env,'REGISTRATION_ACCESS_PIN_ENABLED')&&
    (env.NISVARTHA_UAT_PIN_REGISTRATION==='synthetic'||
     !flag(env,'MEMBER_PORTAL_ENABLED')||
     !flag(env,'MEMBER_APPLICATIONS_ENABLED')||
     !env.MEMBER_TERMS_VERSION?.trim()||
     !env.MEMBER_PRIVACY_VERSION?.trim()))
  bad(fail,'Nonfinancial Admin registration PINs require approved member portal, applications, terms and privacy; synthetic mode cannot be combined');
 if(flag(env,'MATRIX_PLACEMENT_ENABLED')&&
    (!flag(env,'MEMBER_PORTAL_ENABLED')||!flag(env,'MEMBER_APPLICATIONS_ENABLED')))
  bad(fail,'Matrix placement requires approved member portal and applications');
 if(env.MEMBER_COMPENSATION_APPROVED&&!configuredFlag(env,'MEMBER_COMPENSATION_APPROVED'))
  bad(fail,'MEMBER_COMPENSATION_APPROVED must be explicitly true or false');
 if(flag(env,'MEMBER_COMPENSATION_ENABLED')&&
    (!flag(env,'REGISTRATION_ACCESS_PIN_ENABLED')||!flag(env,'MATRIX_PLACEMENT_ENABLED')||
     !flag(env,'MEMBER_PORTAL_ENABLED')||!flag(env,'MEMBER_APPLICATIONS_ENABLED')||
     !env.MEMBER_TERMS_VERSION?.trim()||!env.MEMBER_PRIVACY_VERSION?.trim()||
     env.NISVARTHA_UAT_PIN_REGISTRATION==='synthetic'))
  bad(fail,'Member compensation requires real registration E-PINs, matrix placement, approved member policies and non-synthetic mode');
 if(flag(env,'MEMBER_COMPENSATION_ENABLED')&&!flag(env,'MEMBER_COMPENSATION_APPROVED'))
  bad(fail,'Member compensation requires explicit independent production approval');
 if(flag(env,'REGISTRATION_ACCESS_PIN_ENABLED')&&component==='api'&&
    (!/^[A-Za-z0-9_-]{43}$/.test(env.PIN_VAULT_KEY||'')||
     Buffer.from(env.PIN_VAULT_KEY||'','base64url').toString('base64url')!==env.PIN_VAULT_KEY))
  bad(fail,'Enabled registration PINs require a 256-bit PIN_VAULT_KEY');
 if(component!=='api'&&component!=='web')
  return ['Component must be api or web'];
 if(env.NODE_ENV!=='production')bad(fail,'NODE_ENV must be production');
 if(component==='api'){
  const web=httpsUrl(env.PUBLIC_WEB_ORIGIN,fail,'PUBLIC_WEB_ORIGIN');
  if(web&&web.origin==='https://example.com')
   bad(fail,'PUBLIC_WEB_ORIGIN must not be a documentation placeholder');
  const port=Number(env.PORT);
  if(!/^[1-9][0-9]{0,4}$/.test(env.PORT||'')||port<1024||port>65535)
   bad(fail,'PORT must be a configured unprivileged TCP port');
  if(!['127.0.0.1','::1'].includes(env.HOST))
   bad(fail,'HOST must bind only to loopback behind the approved TLS proxy');
  try{
   const u=new URL(env.DATABASE_URL||'');
   if(u.protocol!=='mysql:'||!u.hostname||!u.pathname||u.pathname==='/'||
      !u.username||!u.password||u.username==='root'||u.password==='replace-me'||
      /(?:^|_)ci(?:$|_)/i.test(decodeURIComponent(u.pathname))||
      u.hostname==='mysql'&&u.username==='nisvartha_ci')
    bad(fail,'DATABASE_URL must identify a non-CI MySQL database with a dedicated non-root account');
  }catch{
   bad(fail,'DATABASE_URL must identify a non-CI MySQL database with a dedicated non-root account');
  }
  const media=env.MEDIA_STORAGE_ROOT||'';
  if(!isAbsolute(media)||media==='/'||media.startsWith('/tmp/')||
     media.startsWith('/var/tmp/')||media.length<6)
   bad(fail,'MEDIA_STORAGE_ROOT must be a persistent absolute private path');
  if(env.MEDIA_SCANNER_BIN!=='clamscan')
   bad(fail,'MEDIA_SCANNER_BIN must be clamscan for production');
  strictBoolean(env,fail,'FORM_SUBMISSIONS_ENABLED','PRIVACY_NOTICE_APPROVED',
   'MEMBER_PORTAL_ENABLED','MEMBER_APPLICATIONS_ENABLED','MEMBER_STAFF_REGISTRATION_ENABLED','MEMBER_RECOVERY_ENABLED',
   'MATRIX_PLACEMENT_ENABLED','MEMBER_COMPENSATION_ENABLED','MEMBER_WALLET_ENABLED');
  if(flag(env,'FORM_SUBMISSIONS_ENABLED')&&!flag(env,'PRIVACY_NOTICE_APPROVED'))
   bad(fail,'Forms require approved privacy notice');
  if(flag(env,'FORM_SUBMISSIONS_ENABLED')&&
     !/^[A-Za-z0-9][A-Za-z0-9._-]{0,29}$/.test(env.PRIVACY_NOTICE_VERSION||''))
   bad(fail,'Enabled forms require a bounded approved privacy notice version');
  if(flag(env,'MEMBER_APPLICATIONS_ENABLED')&&!flag(env,'MEMBER_PORTAL_ENABLED'))
   bad(fail,'Member applications require the member portal');
  if(flag(env,'MEMBER_STAFF_REGISTRATION_ENABLED')&&
    (!flag(env,'MEMBER_PORTAL_ENABLED')||!flag(env,'MEMBER_APPLICATIONS_ENABLED')))
   bad(fail,'Staff-assisted member registration requires approved member applications and portal');
  if(flag(env,'MEMBER_RECOVERY_ENABLED')&&!flag(env,'MEMBER_PORTAL_ENABLED'))
   bad(fail,'Member recovery requires the member portal');
  if(flag(env,'MEMBER_APPLICATIONS_ENABLED')&&
    (!env.MEMBER_TERMS_VERSION?.trim()||!env.MEMBER_PRIVACY_VERSION?.trim()))
   bad(fail,'Member applications require approved terms/privacy version identifiers');
 }else{
  const site=httpsUrl(env.NEXT_PUBLIC_SITE_URL,fail,'NEXT_PUBLIC_SITE_URL');
  const publicApi=httpsUrl(env.NEXT_PUBLIC_API_URL,fail,'NEXT_PUBLIC_API_URL');
  if(site&&publicApi&&site.origin!==publicApi.origin)
   bad(fail,'Browser API origin must match the site origin for same-origin proxy deployment');
  if(site&&site.hostname==='example.com')
   bad(fail,'NEXT_PUBLIC_SITE_URL must not be a placeholder');
  try{
   const u=new URL(env.API_INTERNAL_URL||'');
   if(!['http:','https:'].includes(u.protocol)||
      !['127.0.0.1','::1','[::1]'].includes(u.hostname)||
      u.username||u.password||u.pathname!=='/'||u.search||u.hash)
    bad(fail,'API_INTERNAL_URL must point to the private loopback API');
  }catch{bad(fail,'API_INTERNAL_URL must point to the private loopback API');}
  strictBoolean(env,fail,'PUBLIC_CONTENT_APPROVED','CMS_PUBLIC_CONTENT_ENABLED',
   'NEXT_PUBLIC_FORMS_ENABLED','NEXT_PUBLIC_PRIVACY_APPROVED','MEMBER_PORTAL_ENABLED',
   'MEMBER_APPLICATIONS_ENABLED','MEMBER_STAFF_REGISTRATION_ENABLED','MEMBER_RECOVERY_ENABLED',
   'MATRIX_PLACEMENT_ENABLED','MEMBER_COMPENSATION_ENABLED','MEMBER_WALLET_ENABLED');
  if(flag(env,'CMS_PUBLIC_CONTENT_ENABLED')&&!flag(env,'PUBLIC_CONTENT_APPROVED'))
   bad(fail,'CMS publication requires approved public content');
  if(flag(env,'NEXT_PUBLIC_FORMS_ENABLED')&&!flag(env,'NEXT_PUBLIC_PRIVACY_APPROVED'))
   bad(fail,'Browser forms require approved privacy notice');
  if(flag(env,'MEMBER_APPLICATIONS_ENABLED')&&!flag(env,'MEMBER_PORTAL_ENABLED'))
   bad(fail,'Member application UI requires the member portal');
  if(flag(env,'MEMBER_STAFF_REGISTRATION_ENABLED')&&
    (!flag(env,'MEMBER_PORTAL_ENABLED')||!flag(env,'MEMBER_APPLICATIONS_ENABLED')))
   bad(fail,'Staff-assisted member registration UI requires approved member applications and portal');
  if(flag(env,'MEMBER_RECOVERY_ENABLED')&&!flag(env,'MEMBER_PORTAL_ENABLED'))
   bad(fail,'Member recovery UI requires the member portal');
  if(flag(env,'MEMBER_APPLICATIONS_ENABLED')&&
    (!env.MEMBER_TERMS_VERSION?.trim()||!env.MEMBER_PRIVACY_VERSION?.trim()))
   bad(fail,'Member application UI requires approved policy versions');
 }
 return fail;
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const component=process.argv[2];
 const errors=validateReleaseConfiguration(process.env,component);
 if(errors.length){
  console.error('Nisvartha release preflight blocked:');
  for(const message of errors)console.error('- '+message);
  process.exitCode=1;
 }else console.log('Nisvartha '+component+' production configuration preflight: PASS (not a deployment approval)');
}
