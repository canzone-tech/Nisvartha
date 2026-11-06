import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildReleaseInfo,validateReleasePair,BUILD_KEYS} from './release-profile.mjs';

const api={
 NODE_ENV:'production',HOST:'127.0.0.1',PORT:'3100',
 PUBLIC_WEB_ORIGIN:'https://nisvarthafoundation.in',
 FORM_SUBMISSIONS_ENABLED:'false',PRIVACY_NOTICE_APPROVED:'false',
 MEMBER_PORTAL_ENABLED:'false',MEMBER_APPLICATIONS_ENABLED:'false',
 MEMBER_STAFF_REGISTRATION_ENABLED:'false',MEMBER_RECOVERY_ENABLED:'false',
 REGISTRATION_ACCESS_PIN_ENABLED:'false'
};
const web={
 NEXT_PUBLIC_SITE_URL:'https://nisvarthafoundation.in',
 NEXT_PUBLIC_API_URL:'https://nisvarthafoundation.in',
 API_INTERNAL_URL:'http://127.0.0.1:3100',
 PUBLIC_CONTENT_APPROVED:'false',CMS_PUBLIC_CONTENT_ENABLED:'false',
 NEXT_PUBLIC_FORMS_ENABLED:'false',NEXT_PUBLIC_PRIVACY_APPROVED:'false',
 MEMBER_PORTAL_ENABLED:'false',MEMBER_APPLICATIONS_ENABLED:'false',
 MEMBER_STAFF_REGISTRATION_ENABLED:'false',MEMBER_RECOVERY_ENABLED:'false',
 REGISTRATION_ACCESS_PIN_ENABLED:'false'
};
const manifest=buildReleaseInfo(web,'a'.repeat(40),'0018_owner_confirmed_uat_source');
assert.equal(manifest.profile,'FULL_STACK_DEFAULT_OFF_CANDIDATE');
assert.deepEqual(Object.keys(manifest.build_env),[...BUILD_KEYS]);
assert.deepEqual(validateReleasePair(api,web,manifest),[]);
assert.ok(!JSON.stringify(manifest).includes('DATABASE_URL'),
 'Release metadata must contain no MySQL credentials');
const fail=(apiChange={},webChange={},manifestChange={},key)=>{
 const issues=validateReleasePair({...api,...apiChange},
  {...web,...webChange},{...manifest,...manifestChange});
 assert.ok(issues.some(x=>x.includes(key)),
  'Unsafe release pair accepted: '+key+'; '+issues.join('; '));
};
fail({MEMBER_PORTAL_ENABLED:'true'},{}, {},'MEMBER_PORTAL_ENABLED');
fail({}, {MEMBER_PORTAL_ENABLED:'true'}, {},'Compiled MEMBER_PORTAL_ENABLED');
fail({FORM_SUBMISSIONS_ENABLED:'true'},{}, {},'form state');
fail({PRIVACY_NOTICE_APPROVED:'true'},{}, {},'privacy approval');
fail({PORT:'3900'},{}, {},'Private API origin');
fail({}, {API_INTERNAL_URL:'http://127.0.0.1:3101'}, {},'Private API origin');
fail({}, {NEXT_PUBLIC_SITE_URL:'https://other.example'}, {},'Compiled NEXT_PUBLIC_SITE_URL');
fail({}, {},{build_env:{...manifest.build_env,NEXT_PUBLIC_FORMS_ENABLED:'true'}},
 'Compiled NEXT_PUBLIC_FORMS_ENABLED');
fail({}, {},{build_env:{}},'Compiled NEXT_PUBLIC_SITE_URL');
fail({}, {},{commit:'unexpected'},'Release identity');
fail({}, {},{profile:'UNKNOWN'},'release profile');
const enabledApi={...api,MEMBER_PORTAL_ENABLED:'true',MEMBER_APPLICATIONS_ENABLED:'true',
 MEMBER_TERMS_VERSION:'terms-v2',MEMBER_PRIVACY_VERSION:'privacy-v2',
 REGISTRATION_ACCESS_PIN_ENABLED:'true'};
const enabledWeb={...web,MEMBER_PORTAL_ENABLED:'true',MEMBER_APPLICATIONS_ENABLED:'true',
 MEMBER_TERMS_VERSION:'terms-v2',MEMBER_PRIVACY_VERSION:'privacy-v2',
 REGISTRATION_ACCESS_PIN_ENABLED:'true'};
const live=buildReleaseInfo(enabledWeb,'b'.repeat(40),'0018_owner_confirmed_uat_source');
assert.equal(live.profile,'FULL_STACK_CONFIGURED_CANDIDATE');
assert.deepEqual(validateReleasePair(enabledApi,enabledWeb,live),[]);
assert.ok(validateReleasePair({...enabledApi,MEMBER_PRIVACY_VERSION:'older'},
 enabledWeb,live).some(x=>x.includes('MEMBER_PRIVACY_VERSION')));
assert.ok(validateReleasePair(enabledApi,enabledWeb,manifest)
 .some(x=>x.includes('Compiled MEMBER_PORTAL_ENABLED')),
 'Default-off artifact cannot be used for approved member-enabled runtime');

// Exercise actual executable against detached env-file inputs, not only JS imports.
const dir=mkdtempSync(join(tmpdir(),'nisvartha-release-parity-'));
try{
 const apiFile=join(dir,'api.env'),webFile=join(dir,'web.env'),
 manifestFile=join(dir,'RELEASE_INFO.json');
 const envString=values=>Object.entries(values).map(([k,v])=>k+'='+v).join('\n')+'\n';
 writeFileSync(apiFile,envString(api));
 writeFileSync(webFile,envString(web));
 writeFileSync(manifestFile,JSON.stringify(manifest));
 const args=['scripts/release-profile.mjs','check',apiFile,webFile,manifestFile];
 const good=spawnSync(process.execPath,args,{encoding:'utf8'});
 assert.equal(good.status,0,'Production release profile CLI rejected valid artifact');
 writeFileSync(webFile,envString({...web,MEMBER_PORTAL_ENABLED:'true'}));
 const bad=spawnSync(process.execPath,args,{encoding:'utf8'});
 assert.notEqual(bad.status,0,'CLI accepted altered runtime flags');
 assert.match(bad.stderr,/mismatch|Compiled/);
}finally{rmSync(dir,{recursive:true,force:true})}
console.log('Deployment release profile: compiled flag parity, domain, API target and live member configuration: PASS');
