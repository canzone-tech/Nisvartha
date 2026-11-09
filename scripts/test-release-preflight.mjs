import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {validateReleaseConfiguration} from './release-preflight.mjs';

const vaultKey=Buffer.alloc(32,0xa5).toString('base64url'); // deterministic fixture only
const api={
 NODE_ENV:'production',PORT:'3100',HOST:'127.0.0.1',
 DATABASE_URL:'mysql://nisvartha_app:synthetic_for_tests@127.0.0.1:3306/nisvartha',
 PUBLIC_WEB_ORIGIN:'https://nisvartha.invalid',
 MEDIA_STORAGE_ROOT:'/srv/nisvartha/shared/media',MEDIA_SCANNER_BIN:'clamscan',
 FORM_SUBMISSIONS_ENABLED:'false',PRIVACY_NOTICE_APPROVED:'false',
 MEMBER_PORTAL_ENABLED:'false',MEMBER_APPLICATIONS_ENABLED:'false',
 MEMBER_STAFF_REGISTRATION_ENABLED:'false',MEMBER_RECOVERY_ENABLED:'false',
 MATRIX_PLACEMENT_ENABLED:'false',MEMBER_COMPENSATION_ENABLED:'false',
 MEMBER_COMPENSATION_APPROVED:'false'
};
const web={
 NODE_ENV:'production',NEXT_PUBLIC_SITE_URL:'https://nisvartha.invalid',
 NEXT_PUBLIC_API_URL:'https://nisvartha.invalid',
 API_INTERNAL_URL:'http://127.0.0.1:3100',
 PUBLIC_CONTENT_APPROVED:'false',CMS_PUBLIC_CONTENT_ENABLED:'false',
 NEXT_PUBLIC_FORMS_ENABLED:'false',NEXT_PUBLIC_PRIVACY_APPROVED:'false',
 MEMBER_PORTAL_ENABLED:'false',MEMBER_APPLICATIONS_ENABLED:'false',
 MEMBER_STAFF_REGISTRATION_ENABLED:'false',MEMBER_RECOVERY_ENABLED:'false',
 MATRIX_PLACEMENT_ENABLED:'false',MEMBER_COMPENSATION_ENABLED:'false',
 MEMBER_COMPENSATION_APPROVED:'false'
};
for(const [env,component] of [[api,'api'],[web,'web']]){
 assert.ok(validateReleaseConfiguration({...env,MEMBER_WALLET_ENABLED:'invalid'},component)
  .some(message=>message.includes('MEMBER_WALLET_ENABLED must be explicitly')),
  'Wallet production flag must be strictly validated');
 assert.ok(validateReleaseConfiguration({...env,MEMBER_WALLET_ENABLED:'true'},component)
  .some(message=>message.includes('Member wallet requires the authenticated member portal')),
  'Wallet cannot be enabled without member authentication');
 assert.deepEqual(validateReleaseConfiguration({...env,
  MEMBER_WALLET_ENABLED:'true',MEMBER_PORTAL_ENABLED:'true'},component),[],
  'Read-only wallet must be available in nonfinancial member mode');
}
assert.deepEqual(validateReleaseConfiguration(api,'api'),[]);
assert.deepEqual(validateReleaseConfiguration(web,'web'),[]);
assert.ok(validateReleaseConfiguration({...api,NISVARTHA_UAT_PIN_REGISTRATION:'synthetic'},'api')
 .some(message=>message.includes('prohibited in production')));
assert.ok(validateReleaseConfiguration({...web,NISVARTHA_UAT_PIN_REGISTRATION:'synthetic'},'web')
 .some(message=>message.includes('prohibited in production')));
assert.deepEqual(validateReleaseConfiguration(api,'other'),['Component must be api or web']);
for(const component of ['api','web']){
 const env=component==='api'?api:web;
 assert.ok(validateReleaseConfiguration({...env,REGISTRATION_ACCESS_PIN_ENABLED:'true'},component)
  .some(x=>x.includes('require approved member portal')),'PIN release needs approved policy');
 assert.ok(validateReleaseConfiguration({...env,REGISTRATION_ACCESS_PIN_ENABLED:'maybe'},component)
  .some(x=>x.includes('must be explicitly')),'PIN flag must fail closed');
}
for(const [env,component] of [[api,'api'],[web,'web']]){
 assert.ok(validateReleaseConfiguration({...env,MEMBER_PIN_AUTO_ACTIVATE_ENABLED:'true'},component)
  .some(message=>message.includes('Immediate E-PIN activation requires')),
  'Unconfigured immediate activation must fail closed: '+component);
 assert.ok(validateReleaseConfiguration({...env,MEMBER_PIN_AUTO_ACTIVATE_ENABLED:'invalid'},component)
  .some(message=>message.includes('explicitly true or false')),
  'Auto activation flag must be a strict boolean');
 const valid={...env,MEMBER_PIN_AUTO_ACTIVATE_ENABLED:'true',
  REGISTRATION_ACCESS_PIN_ENABLED:'true',MATRIX_PLACEMENT_ENABLED:'true',
  MEMBER_PORTAL_ENABLED:'true',MEMBER_APPLICATIONS_ENABLED:'true',
  MEMBER_STAFF_REGISTRATION_ENABLED:'true',
  MEMBER_TERMS_VERSION:'approved-terms',MEMBER_PRIVACY_VERSION:'approved-privacy',
  ...(component==='api'?{PIN_VAULT_KEY:vaultKey}:{})};
 assert.deepEqual(validateReleaseConfiguration(valid,component),[],
  'Legal nonfinancial direct activation must permit isolated registration flow');
 assert.ok(validateReleaseConfiguration({...valid,MEMBER_COMPENSATION_ENABLED:'true'},component)
  .some(message=>message.includes('explicit independent production approval')),
  'Auto activation cannot bypass independent financial approval');
 assert.deepEqual(validateReleaseConfiguration({...valid,MEMBER_COMPENSATION_ENABLED:'true',
  MEMBER_COMPENSATION_APPROVED:'true'},component),[],
  'Reviewed finance and instant registration must be configuration compatible');
}
assert.deepEqual(validateReleaseConfiguration({...api,REGISTRATION_ACCESS_PIN_ENABLED:'true',
 MEMBER_PORTAL_ENABLED:'true',MEMBER_APPLICATIONS_ENABLED:'true',
 MEMBER_TERMS_VERSION:'approved-terms',MEMBER_PRIVACY_VERSION:'approved-privacy',PIN_VAULT_KEY:vaultKey},'api'),[]);
const noncanonical=vaultKey.slice(0,-1)+'B';
assert.ok(validateReleaseConfiguration({...api,REGISTRATION_ACCESS_PIN_ENABLED:'true',
 MEMBER_PORTAL_ENABLED:'true',MEMBER_APPLICATIONS_ENABLED:'true',
 MEMBER_TERMS_VERSION:'approved-terms',MEMBER_PRIVACY_VERSION:'approved-privacy',
 PIN_VAULT_KEY:noncanonical},'api').some(x=>x.includes('256-bit PIN_VAULT_KEY')),
 'Noncanonical vault key must fail preflight');
assert.ok(validateReleaseConfiguration({...api,REGISTRATION_ACCESS_PIN_ENABLED:'true',
 MEMBER_PORTAL_ENABLED:'true',MEMBER_APPLICATIONS_ENABLED:'true',
 MEMBER_TERMS_VERSION:'approved-terms',MEMBER_PRIVACY_VERSION:'approved-privacy'},'api')
 .some(x=>x.includes('256-bit PIN_VAULT_KEY')),'Production Admin PINs must require recoverability key');
assert.ok(validateReleaseConfiguration({...api,REGISTRATION_ACCESS_PIN_ENABLED:'true',
 MEMBER_PORTAL_ENABLED:'true',MEMBER_APPLICATIONS_ENABLED:'true',
 MEMBER_TERMS_VERSION:'approved-terms',MEMBER_PRIVACY_VERSION:'approved-privacy',PIN_VAULT_KEY:'weak'},'api')
 .some(x=>x.includes('256-bit PIN_VAULT_KEY')),'Weak encryption key must fail closed');
assert.deepEqual(validateReleaseConfiguration({...web,REGISTRATION_ACCESS_PIN_ENABLED:'true',
 MEMBER_PORTAL_ENABLED:'true',MEMBER_APPLICATIONS_ENABLED:'true',
 MEMBER_TERMS_VERSION:'approved-terms',MEMBER_PRIVACY_VERSION:'approved-privacy'},'web'),[]);
for(const [env,component] of [[api,'api'],[web,'web']]){
 assert.ok(validateReleaseConfiguration({...env,MATRIX_PLACEMENT_ENABLED:'true'},component)
  .some(x=>x.includes('Matrix placement requires')),'Matrix must require member flow');
 assert.ok(validateReleaseConfiguration({...env,MEMBER_COMPENSATION_ENABLED:'true'},component)
  .some(x=>x.includes('Member compensation requires')),'Compensation must fail without E-PIN/matrix dependencies');
}
for(const [env,component] of [[api,'api'],[web,'web']]){
 const enabled={...env,REGISTRATION_ACCESS_PIN_ENABLED:'true',
  MATRIX_PLACEMENT_ENABLED:'true',MEMBER_COMPENSATION_ENABLED:'true',
  MEMBER_PORTAL_ENABLED:'true',MEMBER_APPLICATIONS_ENABLED:'true',
  MEMBER_TERMS_VERSION:'approved-terms',MEMBER_PRIVACY_VERSION:'approved-privacy',
  ...(component==='api'?{PIN_VAULT_KEY:vaultKey}:{})};
 assert.ok(validateReleaseConfiguration(enabled,component)
  .some(x=>x.includes('explicit independent production approval')),
  'Compensation must remain fail-closed without separate approval');
}
assert.deepEqual(validateReleaseConfiguration({...api,REGISTRATION_ACCESS_PIN_ENABLED:'true',
 MATRIX_PLACEMENT_ENABLED:'true',MEMBER_COMPENSATION_ENABLED:'true',
 MEMBER_COMPENSATION_APPROVED:'true',MEMBER_PORTAL_ENABLED:'true',MEMBER_APPLICATIONS_ENABLED:'true',
 MEMBER_TERMS_VERSION:'approved-terms',MEMBER_PRIVACY_VERSION:'approved-privacy',PIN_VAULT_KEY:vaultKey},'api'),[]);
assert.deepEqual(validateReleaseConfiguration({...web,REGISTRATION_ACCESS_PIN_ENABLED:'true',
 MATRIX_PLACEMENT_ENABLED:'true',MEMBER_COMPENSATION_ENABLED:'true',
 MEMBER_COMPENSATION_APPROVED:'true',MEMBER_PORTAL_ENABLED:'true',MEMBER_APPLICATIONS_ENABLED:'true',
 MEMBER_TERMS_VERSION:'approved-terms',MEMBER_PRIVACY_VERSION:'approved-privacy'},'web'),[]);
for(const key of ['NISVARTHA_UAT_FORMS','NISVARTHA_UAT_MEMBERS','NISVARTHA_UAT_PIN_FLOW']){
 for(const [env,component] of [[api,'api'],[web,'web']]){
  assert.ok(validateReleaseConfiguration({...env,[key]:'synthetic'},component)
   .some(message=>message.includes('prohibited in production')),
   'Release preflight must reject '+key);
 }
}
for(const [env,component] of [[api,'api'],[web,'web']]){
 assert.ok(validateReleaseConfiguration({...env,NISVARTHA_UAT_PLAN:'synthetic'},component)
  .some(message=>message.includes('prohibited in production')),
  'Synthetic plan review must fail production preflight');
}
for(const [env,component] of [[api,'api'],[web,'web']]){
 assert.ok(validateReleaseConfiguration({...env,NISVARTHA_CLIENT_TEMPLATE_PREVIEW:'true'},component)
  .some(x=>x.includes('prohibited in production')));
}

const rejects=(env,component,change,needle)=>{
 const errors=validateReleaseConfiguration({...env,...change},component);
 assert.ok(errors.some(e=>e.includes(needle)),component+' accepted '+needle+': '+errors.join('; '));
 // A diagnostic must never contain a raw credential or external env value.
 assert.ok(errors.every(e=>!e.includes('synthetic_for_tests')));
};
for(const [change,needle] of [
 [{NODE_ENV:'development'},'NODE_ENV'],
 [{PORT:'0'},'PORT'],
 [{HOST:'0.0.0.0'},'HOST'],
 [{DATABASE_URL:'mysql://root:test@127.0.0.1/nisvartha'},'DATABASE_URL'],
 [{DATABASE_URL:'mysql://nisvartha_ci:testpass@127.0.0.1/nisvartha_ci'},'DATABASE_URL'],
 [{DATABASE_URL:'not-a-url'},'DATABASE_URL'],
 [{PUBLIC_WEB_ORIGIN:'http://example.com'},'PUBLIC_WEB_ORIGIN'],
 [{PUBLIC_WEB_ORIGIN:'https://example.com'},'placeholder'],
 [{MEDIA_STORAGE_ROOT:'/tmp/cache'},'MEDIA_STORAGE_ROOT'],
 [{MEDIA_STORAGE_ROOT:'relative'},'MEDIA_STORAGE_ROOT'],
 [{MEDIA_SCANNER_BIN:'scripts/ci-media-scanner.sh'},'MEDIA_SCANNER_BIN'],
 [{FORM_SUBMISSIONS_ENABLED:'true'},'Forms require approved'],
 [{FORM_SUBMISSIONS_ENABLED:'true',PRIVACY_NOTICE_APPROVED:'true'},'notice version'],
 [{MEMBER_APPLICATIONS_ENABLED:'true'},'member portal'],
 [{MEMBER_APPLICATIONS_ENABLED:'true',MEMBER_PORTAL_ENABLED:'true'},'approved terms/privacy'],
 [{MEMBER_RECOVERY_ENABLED:'true'},'member portal'],
 [{MEMBER_STAFF_REGISTRATION_ENABLED:'true'},'Staff-assisted member registration requires'],
 [{MEMBER_STAFF_REGISTRATION_ENABLED:'unknown'},'explicitly true or false'],
 [{PRIVACY_NOTICE_APPROVED:'yes'},'explicitly true or false']
])rejects(api,'api',change,needle);
for(const [change,needle] of [
 [{NODE_ENV:'test'},'NODE_ENV'],
 [{NEXT_PUBLIC_SITE_URL:'http://nisvartha.invalid'},'NEXT_PUBLIC_SITE_URL'],
 [{NEXT_PUBLIC_SITE_URL:'https://example.com'},'placeholder'],
 [{NEXT_PUBLIC_API_URL:'https://other.invalid'},'match the site'],
 [{NEXT_PUBLIC_API_URL:'http://nisvartha.invalid'},'NEXT_PUBLIC_API_URL'],
 [{API_INTERNAL_URL:'https://public.invalid'},'loopback'],
 [{API_INTERNAL_URL:'http://127.0.0.1:3100/admin'},'loopback'],
 [{CMS_PUBLIC_CONTENT_ENABLED:'true'},'approved public content'],
 [{NEXT_PUBLIC_FORMS_ENABLED:'true'},'approved privacy notice'],
 [{MEMBER_APPLICATIONS_ENABLED:'true'},'member portal'],
 [{MEMBER_APPLICATIONS_ENABLED:'true',MEMBER_PORTAL_ENABLED:'true'},'approved policy versions'],
 [{MEMBER_RECOVERY_ENABLED:'true'},'member portal'],
 [{MEMBER_STAFF_REGISTRATION_ENABLED:'true'},'Staff-assisted member registration UI requires'],
 [{MEMBER_STAFF_REGISTRATION_ENABLED:'unknown'},'explicitly true or false'],
 [{PUBLIC_CONTENT_APPROVED:'unknown'},'explicitly true or false']
])rejects(web,'web',change,needle);

assert.deepEqual(validateReleaseConfiguration({...api,
 FORM_SUBMISSIONS_ENABLED:'true',PRIVACY_NOTICE_APPROVED:'true',PRIVACY_NOTICE_VERSION:'APPROVED-2026',
 MEMBER_PORTAL_ENABLED:'true',MEMBER_APPLICATIONS_ENABLED:'true',
 MEMBER_STAFF_REGISTRATION_ENABLED:'true',
 MEMBER_TERMS_VERSION:'TERMS-2026',MEMBER_PRIVACY_VERSION:'PRIVACY-2026'
},'api'),[]);
assert.deepEqual(validateReleaseConfiguration({...web,
 PUBLIC_CONTENT_APPROVED:'true',CMS_PUBLIC_CONTENT_ENABLED:'true',
 NEXT_PUBLIC_FORMS_ENABLED:'true',NEXT_PUBLIC_PRIVACY_APPROVED:'true',
 MEMBER_PORTAL_ENABLED:'true',MEMBER_APPLICATIONS_ENABLED:'true',
 MEMBER_STAFF_REGISTRATION_ENABLED:'true',
 MEMBER_TERMS_VERSION:'TERMS-2026',MEMBER_PRIVACY_VERSION:'PRIVACY-2026'
},'web'),[]);
// The actual one-command host wrapper must be syntactically valid and must
// fail closed before contacting a live URL if required config is absent.
const syntax=spawnSync('bash',['-n','scripts/verify-deployment.sh'],{encoding:'utf8'});
assert.equal(syntax.status,0,'Host wrapper syntax invalid: '+syntax.stderr);
const noConfig=spawnSync('bash',['scripts/verify-deployment.sh'],{
 env:{PATH:process.env.PATH},encoding:'utf8'
});
assert.notEqual(noConfig.status,0,'Host wrapper ran without release environment');
const relative=spawnSync('bash',['scripts/verify-deployment.sh'],{
 env:{PATH:process.env.PATH,NISVARTHA_API_ENV_FILE:'relative.env',
 NISVARTHA_WEB_ENV_FILE:'/tmp/not-a-release-env',
 SMOKE_WEB_ORIGIN:'https://nisvartha.invalid'},encoding:'utf8'
});
assert.notEqual(relative.status,0,'Host wrapper accepted non-absolute environment path');
assert.match(relative.stderr,/paths must be absolute/,
 'Host wrapper must fail before reading invalid environment files');

await import('./test-release-profile.mjs');
console.log('Nisvartha production environment preflight: approved-gate dependencies, no CI DB, private API binding and safe diagnostics PASS');
