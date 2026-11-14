import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// These are *non-secret* Next.js build/configuration inputs. Node runtime
// environment variables cannot retroactively change a compiled frontend.
export const BUILD_KEYS=Object.freeze([
 'NEXT_PUBLIC_SITE_URL','NEXT_PUBLIC_API_URL','PUBLIC_CONTENT_APPROVED',
 'CMS_PUBLIC_CONTENT_ENABLED','NEXT_PUBLIC_FORMS_ENABLED',
 'NEXT_PUBLIC_PRIVACY_APPROVED','MEMBER_PORTAL_ENABLED',
 'MEMBER_APPLICATIONS_ENABLED','MEMBER_STAFF_REGISTRATION_ENABLED',
 'MEMBER_RECOVERY_ENABLED','REGISTRATION_ACCESS_PIN_ENABLED','MEMBER_PIN_AUTO_ACTIVATE_ENABLED',
 'MATRIX_PLACEMENT_ENABLED','DONATION_ACCOUNTING_ENABLED','MEMBER_COMPENSATION_ENABLED','MEMBER_WALLET_ENABLED',
 'MEMBER_COMPENSATION_APPROVED','PAID_PIN_ISSUANCE_ENABLED','PAID_PIN_ACCOUNTING_APPROVED','MEMBER_TERMS_VERSION','MEMBER_PRIVACY_VERSION'
]);
const SHARED_FLAGS=[
 'MEMBER_PORTAL_ENABLED','MEMBER_APPLICATIONS_ENABLED',
 'MEMBER_STAFF_REGISTRATION_ENABLED','MEMBER_RECOVERY_ENABLED',
 'REGISTRATION_ACCESS_PIN_ENABLED','MEMBER_PIN_AUTO_ACTIVATE_ENABLED','MATRIX_PLACEMENT_ENABLED','MEMBER_COMPENSATION_ENABLED',
 'MEMBER_COMPENSATION_APPROVED','MEMBER_WALLET_ENABLED','DONATION_ACCOUNTING_ENABLED',
 'PAID_PIN_ISSUANCE_ENABLED','PAID_PIN_ACCOUNTING_APPROVED'
];
const val=(env,key)=>env[key]??'';

export function buildReleaseInfo(env,commit,migrationHead){
 if(!/^[a-f0-9]{40}$/.test(commit||'')||
    !/^00\d{2}_[a-z0-9_]+$/.test(migrationHead||''))
  throw Error('Release manifest requires a full commit SHA and migration head');
 const flags=Object.fromEntries(BUILD_KEYS.map(key=>[key,val(env,key)]));
 const enabled=BUILD_KEYS.some(key=>flags[key]==='true');
 return {
  commit,origin:new URL(flags.NEXT_PUBLIC_SITE_URL).origin,
  profile:enabled?'FULL_STACK_CONFIGURED_CANDIDATE':'FULL_STACK_DEFAULT_OFF_CANDIDATE',
  release_channel:env.NISVARTHA_RELEASE_CHANNEL||'unclassified',
  node_major:22,migration_head:migrationHead,build_env:flags
 };
}
/** Only these channels can be installed on the Foundation host.
 * A nonfinancial review is never relabelled as full-feature client acceptance.
 * CI synthetic artifacts cannot pass either deployable validator.
 */
const COMMON_REQUIRED=[
 'MEMBER_PORTAL_ENABLED','MEMBER_APPLICATIONS_ENABLED',
 'MEMBER_STAFF_REGISTRATION_ENABLED','REGISTRATION_ACCESS_PIN_ENABLED',
 'MEMBER_PIN_AUTO_ACTIVATE_ENABLED','MATRIX_PLACEMENT_ENABLED',
 'MEMBER_WALLET_ENABLED','DONATION_ACCOUNTING_ENABLED'
];
const FINANCE_REQUIRED=[
 'MEMBER_COMPENSATION_ENABLED','MEMBER_COMPENSATION_APPROVED',
 'PAID_PIN_ISSUANCE_ENABLED','PAID_PIN_ACCOUNTING_APPROVED'
];
function validateChannel(release,channel,financeEnabled){
 const issues=[];
 const flags=release?.build_env;
 if(release?.release_channel!==channel)
  issues.push('Only the '+channel+' release channel is deployable');
 if(release?.profile!=='FULL_STACK_CONFIGURED_CANDIDATE'||!flags)
  return [...issues,'Configured compiled release profile is required'];
 for(const key of COMMON_REQUIRED)
  if(flags[key]!=='true')issues.push('Client review requires '+key);
 for(const key of FINANCE_REQUIRED)
  if(flags[key]!==String(financeEnabled))
   issues.push('Finance flag mismatch: '+key+' must be '+financeEnabled);
 for(const key of ['MEMBER_TERMS_VERSION','MEMBER_PRIVACY_VERSION']){
  const version=flags[key]||'';
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/.test(version)||
     /(?:^|[._-])(?:ci|test|demo|sample|draft|preview)(?:[._-]|$)/i.test(version))
   issues.push('Reviewed non-test policy version required: '+key);
 }
 return issues;
}
export function validateClientReviewArtifact(release){
 return validateChannel(release,'client-review',false);
}
export function validateClientAcceptanceArtifact(release){
 return validateChannel(release,'client-acceptance',true);
}
export function validateDeployableArtifact(release){
 if(release?.release_channel==='client-review')
  return validateClientReviewArtifact(release);
 if(release?.release_channel==='client-acceptance')
  return validateClientAcceptanceArtifact(release);
 return ['Release channel is neither client-review nor client-acceptance'];
}

/** Derive the public member-registration gate from the approved compiled feature profile.
 * The standalone Next.js server reads this value at runtime, so the release
 * preparer must supply it explicitly instead of inheriting an operator shell.
 */
export function publicRegistrationFlag(release){
 const flags=release?.build_env??{};
 return String(flags.MEMBER_PORTAL_ENABLED==='true'&&
  flags.MEMBER_APPLICATIONS_ENABLED==='true'&&
  flags.REGISTRATION_ACCESS_PIN_ENABLED==='true');
}

export function validateReleasePair(api,web,release){
 const errors=[];
 const error=name=>errors.push(name+' mismatch or missing');
 if(!release||typeof release!=='object'||Array.isArray(release))
  return ['Release manifest missing or invalid'];
 if(!/^[a-f0-9]{40}$/.test(release.commit||'')||
    release.node_major!==22||
    !/^00\d{2}_[a-z0-9_]+$/.test(release.migration_head||''))
  error('Release identity');
 if(!['FULL_STACK_DEFAULT_OFF_CANDIDATE',
      'FULL_STACK_CONFIGURED_CANDIDATE'].includes(release.profile))
  error('Full-stack release profile');
 if(!release.build_env||typeof release.build_env!=='object'||
    Array.isArray(release.build_env))return [...errors,'Compiled web flags missing'];
 if(Object.keys(release.build_env).some(key=>!BUILD_KEYS.includes(key)))
  error('Unrecognized compiled configuration');
 for(const key of BUILD_KEYS)
  if(typeof release.build_env[key]!=='string'||
     val(web,key)!==release.build_env[key])error('Compiled '+key);
 for(const key of SHARED_FLAGS)
  if(val(api,key)!==val(web,key))error('API/web '+key);
 if(val(web,'MEMBER_PUBLIC_REGISTRATION_ENABLED')!==publicRegistrationFlag(release))
  error('Member public registration runtime gate');
 for(const key of ['MEMBER_TERMS_VERSION','MEMBER_PRIVACY_VERSION'])
  if(web.MEMBER_APPLICATIONS_ENABLED==='true'&&val(api,key)!==val(web,key))
   error('API/web '+key);
 if(val(api,'FORM_SUBMISSIONS_ENABLED')!==val(web,'NEXT_PUBLIC_FORMS_ENABLED'))
  error('Contact/volunteer form state');
 if(val(api,'PRIVACY_NOTICE_APPROVED')!==val(web,'NEXT_PUBLIC_PRIVACY_APPROVED'))
  error('Form privacy approval state');
 try{
  const site=new URL(val(web,'NEXT_PUBLIC_SITE_URL'));
  const browserApi=new URL(val(web,'NEXT_PUBLIC_API_URL'));
  const serverApi=new URL(val(api,'PUBLIC_WEB_ORIGIN'));
  const internal=new URL(val(web,'API_INTERNAL_URL'));
  if(site.origin!==serverApi.origin||site.origin!==browserApi.origin||
     site.origin!==release.origin)error('Public HTTPS origin');
  if(internal.protocol!=='http:'||
     internal.hostname!==val(api,'HOST')||
     internal.port!==val(api,'PORT'))error('Private API origin');
 }catch{error('API/website origin')}
 // A profile is descriptive, never authorization. An all-off artifact cannot
 // be silently relabelled as a configured operational release.
 if(release.profile==='FULL_STACK_DEFAULT_OFF_CANDIDATE'&&
    BUILD_KEYS.some(key=>release.build_env[key]==='true'))error('Release profile classification');
 return errors;
}
function readEnv(path){
 return parseEnv(readFileSync(path,'utf8'));
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 try{
  const operation=process.argv[2];
  if(operation==='create'){
   const info=buildReleaseInfo(process.env,process.env.GITHUB_SHA,
    process.argv[3]);
   process.stdout.write(JSON.stringify(info)+'\n');
  }else if(operation==='check'){
   const [apiPath,webPath,manifestPath]=process.argv.slice(3);
   if(!apiPath||!webPath||!manifestPath)
    throw Error('API env, web env and release manifest paths are required');
   const release=JSON.parse(readFileSync(manifestPath,'utf8'));
   const errors=validateReleasePair(readEnv(apiPath),readEnv(webPath),release);
   const approved=process.env.NISVARTHA_RELEASE_APPROVED_SHA;
   if(approved){
    if(!/^[a-f0-9]{40}$/.test(approved))
     errors.push('Approved release commit SHA invalid');
    else if(release.commit!==approved)
     errors.push('Approved release commit SHA mismatch');
   }
   if(errors.length)throw Error(errors.join('; '));
   console.log('Nisvartha compiled frontend / live API configuration parity: PASS');
  }else throw Error('Expected create or check operation');
 }catch(e){
  // Field names only; never print file contents, credentials or raw values.
  console.error('Release profile check refused: '+
   (e instanceof Error&&/mismatch|missing|Compiled|Release profile|origin|state|classification|configuration|Approved release commit SHA invalid/.test(e.message)
    ?e.message:'invalid release manifest or environment files'));
  process.exitCode=1;
 }
}
