import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildReleaseInfo,validateReleasePair,validateClientReviewArtifact,validateClientAcceptanceArtifact,validateDeployableArtifact,BUILD_KEYS,publicRegistrationFlag} from './release-profile.mjs';

const api={
 NODE_ENV:'production',HOST:'127.0.0.1',PORT:'3100',
 PUBLIC_WEB_ORIGIN:'https://nisvarthafoundation.in',
 FORM_SUBMISSIONS_ENABLED:'false',PRIVACY_NOTICE_APPROVED:'false',
 MEMBER_PORTAL_ENABLED:'false',MEMBER_APPLICATIONS_ENABLED:'false',
 MEMBER_STAFF_REGISTRATION_ENABLED:'false',MEMBER_RECOVERY_ENABLED:'false',
 REGISTRATION_ACCESS_PIN_ENABLED:'false',MATRIX_PLACEMENT_ENABLED:'false',
 MEMBER_COMPENSATION_ENABLED:'false'
};
const web={
 NEXT_PUBLIC_SITE_URL:'https://nisvarthafoundation.in',
 NEXT_PUBLIC_API_URL:'https://nisvarthafoundation.in',
 API_INTERNAL_URL:'http://127.0.0.1:3100',
 PUBLIC_CONTENT_APPROVED:'false',CMS_PUBLIC_CONTENT_ENABLED:'false',
 NEXT_PUBLIC_FORMS_ENABLED:'false',NEXT_PUBLIC_PRIVACY_APPROVED:'false',
 MEMBER_PORTAL_ENABLED:'false',MEMBER_APPLICATIONS_ENABLED:'false',
 MEMBER_STAFF_REGISTRATION_ENABLED:'false',MEMBER_RECOVERY_ENABLED:'false',
 REGISTRATION_ACCESS_PIN_ENABLED:'false',MATRIX_PLACEMENT_ENABLED:'false',
 MEMBER_COMPENSATION_ENABLED:'false',MEMBER_PUBLIC_REGISTRATION_ENABLED:'false'
};
const manifest=buildReleaseInfo(web,'a'.repeat(40),'0018_owner_confirmed_uat_source');
assert.equal(manifest.profile,'FULL_STACK_DEFAULT_OFF_CANDIDATE');
assert.equal(publicRegistrationFlag(manifest),'false');
assert.ok(validateClientReviewArtifact(manifest).length>0,'Held release must not be deployable');
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
fail({}, {MEMBER_PUBLIC_REGISTRATION_ENABLED:'true'}, {},'Member public registration runtime gate');
fail({}, {MEMBER_PORTAL_ENABLED:'true'}, {},'Compiled MEMBER_PORTAL_ENABLED');
fail({MEMBER_COMPENSATION_ENABLED:'true'},{}, {},'MEMBER_COMPENSATION_ENABLED');
fail({PAID_PIN_ISSUANCE_ENABLED:'true'},{}, {},'PAID_PIN_ISSUANCE_ENABLED');
fail({}, {PAID_PIN_ACCOUNTING_APPROVED:'true'}, {},'Compiled PAID_PIN_ACCOUNTING_APPROVED');
fail({}, {MEMBER_COMPENSATION_ENABLED:'true'}, {},'Compiled MEMBER_COMPENSATION_ENABLED');
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
 REGISTRATION_ACCESS_PIN_ENABLED:'true',MATRIX_PLACEMENT_ENABLED:'true',
 MEMBER_COMPENSATION_ENABLED:'true'};
const enabledWeb={...web,MEMBER_PORTAL_ENABLED:'true',MEMBER_APPLICATIONS_ENABLED:'true',
 MEMBER_TERMS_VERSION:'terms-v2',MEMBER_PRIVACY_VERSION:'privacy-v2',
 REGISTRATION_ACCESS_PIN_ENABLED:'true',MATRIX_PLACEMENT_ENABLED:'true',
 MEMBER_COMPENSATION_ENABLED:'true'};
const live=buildReleaseInfo(enabledWeb,'b'.repeat(40),'0018_owner_confirmed_uat_source');
assert.equal(live.profile,'FULL_STACK_CONFIGURED_CANDIDATE');
const client=buildReleaseInfo({...enabledWeb,
 MEMBER_COMPENSATION_ENABLED:'false',MEMBER_COMPENSATION_APPROVED:'false',
 MEMBER_STAFF_REGISTRATION_ENABLED:'true',MEMBER_PIN_AUTO_ACTIVATE_ENABLED:'true',
 MEMBER_WALLET_ENABLED:'true',DONATION_ACCOUNTING_ENABLED:'true',
 PAID_PIN_ISSUANCE_ENABLED:'false',PAID_PIN_ACCOUNTING_APPROVED:'false',
 NISVARTHA_RELEASE_CHANNEL:'client-review'},
 'b'.repeat(40),'0018_owner_confirmed_uat_source');
assert.deepEqual(validateClientReviewArtifact(client),[],'Approved-format client candidate rejected');
assert.equal(publicRegistrationFlag(client),'true',
 'Member registration must be enabled when portal/applications and E-PINs are compiled on');
assert.ok(validateClientReviewArtifact({...client,release_channel:'ci-review-test'}).length>0,
 'Test build must never count as client deployment artifact');
assert.ok(validateClientReviewArtifact({...client,build_env:{...client.build_env,
 MEMBER_PRIVACY_VERSION:'ci-review-test-privacy-v1'}}).length>0,
 'Test-only policy version must prevent deployment');
assert.ok(validateClientReviewArtifact({...client,build_env:{...client.build_env,
 DONATION_ACCOUNTING_ENABLED:'false'}}).length>0,
 'Client review must retain the offline NGO donation register');
assert.ok(validateClientReviewArtifact({...client,build_env:{...client.build_env,
 MEMBER_COMPENSATION_ENABLED:'true'}}).length>0,
 'Unapproved money features must prevent deployment');
assert.ok(validateClientReviewArtifact({...client,build_env:{...client.build_env,
 PAID_PIN_ISSUANCE_ENABLED:'true'}}).some(x=>x.includes('PAID_PIN_ISSUANCE_ENABLED')),
 'Unapproved paid E-PIN issuance must block shipping');
const acceptance=buildReleaseInfo({...client.build_env,
 MEMBER_COMPENSATION_ENABLED:'true',MEMBER_COMPENSATION_APPROVED:'true',
 PAID_PIN_ISSUANCE_ENABLED:'true',PAID_PIN_ACCOUNTING_APPROVED:'true',
 NISVARTHA_RELEASE_CHANNEL:'client-acceptance'},
 'b'.repeat(40),'0037_versioned_offline_sale_amount');
assert.deepEqual(validateClientAcceptanceArtifact(acceptance),[],
 'Full-financial compiled acceptance profile rejected');
assert.deepEqual(validateDeployableArtifact(acceptance),[]);
assert.ok(validateClientReviewArtifact(acceptance).length>0,
 'Full-feature build must never masquerade as client-review');
assert.ok(validateClientAcceptanceArtifact(client).length>0,
 'Nonfinancial client-review cannot be called full-featured');
assert.ok(validateClientAcceptanceArtifact({...acceptance,build_env:{
 ...acceptance.build_env,PAID_PIN_ACCOUNTING_APPROVED:'false'}})
 .some(x=>x.includes('PAID_PIN_ACCOUNTING_APPROVED')),
 'Partial finance profile must not be shipped as full');
assert.ok(validateClientAcceptanceArtifact({...acceptance,release_channel:'ci-finance-test'}).length>0,
 'CI synthetic finance profile must not be deployable');
assert.ok(validateDeployableArtifact({...acceptance,release_channel:'unknown'}).length>0);
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
 const environment={...process.env,NISVARTHA_RELEASE_APPROVED_SHA:''};
 const good=spawnSync(process.execPath,args,{encoding:'utf8',env:environment});
 assert.equal(good.status,0,'Production release profile CLI rejected valid artifact');
 const approved=spawnSync(process.execPath,args,{encoding:'utf8',env:{
  ...environment,NISVARTHA_RELEASE_APPROVED_SHA:'a'.repeat(40)
 }});
 assert.equal(approved.status,0,'Exact approved release SHA was unexpectedly rejected');
 const mismatch=spawnSync(process.execPath,args,{encoding:'utf8',env:{
  ...environment,NISVARTHA_RELEASE_APPROVED_SHA:'b'.repeat(40)
 }});
 assert.notEqual(mismatch.status,0,'Release profile accepted unapproved commit');
 assert.match(mismatch.stderr,/Approved release commit SHA mismatch/);
 const malformed=spawnSync(process.execPath,args,{encoding:'utf8',env:{
  ...environment,NISVARTHA_RELEASE_APPROVED_SHA:'not-a-sha'
 }});
 assert.notEqual(malformed.status,0,'Release profile accepted malformed approval SHA');
 assert.match(malformed.stderr,/Approved release commit SHA invalid/);
 writeFileSync(webFile,envString({...web,MEMBER_PORTAL_ENABLED:'true'}));
 const bad=spawnSync(process.execPath,args,{encoding:'utf8',env:environment});
 assert.notEqual(bad.status,0,'CLI accepted altered runtime flags');
 assert.match(bad.stderr,/mismatch|Compiled/);
}finally{rmSync(dir,{recursive:true,force:true})}
const runtimeApi=readFileSync(new URL('../infra/systemd/nisvartha-api.service',import.meta.url),'utf8');
const runtimeWeb=readFileSync(new URL('../infra/systemd/nisvartha-web.service',import.meta.url),'utf8');
for(const [content,component] of [[runtimeApi,'api'],[runtimeWeb,'web']]){
 assert.match(content,/^User=nisvartha$/m,'Runtime cannot execute as root');
 assert.match(content,/^Group=nisvartha$/m);
 assert.match(content,/^EnvironmentFile=\/etc\/nisvartha\//m);
 assert.match(content,/^NoNewPrivileges=true$/m);
 assert.match(content,/^Restart=on-failure$/m);
 assert.doesNotMatch(content,/testpass|nisvartha_ci|root_verify_only|client-template/,
  'Test-only configuration leaked into production '+component+' service');
}
assert.match(runtimeApi,/^ExecStart=\/usr\/bin\/node \/srv\/nisvartha\/current\/api\/dist\/main\.js$/m);
assert.match(runtimeApi,/^ReadWritePaths=\/srv\/nisvartha\/shared\/media$/m);
assert.match(runtimeWeb,/^ExecStart=\/usr\/bin\/node \/srv\/nisvartha\/current\/web\/server\.js$/m);
assert.match(runtimeWeb,/^Environment=HOSTNAME=127\.0\.0\.1$/m);
console.log('Deployment release profile: compiled flag parity, domain, API target and live member configuration: PASS');
