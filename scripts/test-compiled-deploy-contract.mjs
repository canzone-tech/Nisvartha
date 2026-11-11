import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const installer='scripts/deploy-compiled-apache.sh';
const source=readFileSync(installer,'utf8');
for(const path of [
 installer,'scripts/prepare-release-env.mjs','scripts/smoke-staged-artifact.mjs',
 'scripts/check-release-migrations.mjs','scripts/check-unused-database.mjs'
]){
 const args=path.endsWith('.sh')?['-n',path]:['--check',path];
 const executable=path.endsWith('.sh')?'bash':process.execPath;
 const result=spawnSync(executable,args,{encoding:'utf8'});
 assert.equal(result.status,0,'Release operator script syntax failed: '+path+'\n'+result.stderr);
}
const missing=spawnSync('bash',[installer],{encoding:'utf8',
 env:{PATH:process.env.PATH}});
assert.notEqual(missing.status,0,'Installer must refuse no-argument execution');
assert.match(missing.stderr,/Usage: deploy-compiled-apache/);
const invalid=spawnSync('bash',[installer,'/tmp/not-a-release','invalid-sha'],
 {encoding:'utf8',env:{PATH:process.env.PATH}});
assert.notEqual(invalid.status,0,'Installer must reject a malformed SHA');
assert.match(invalid.stderr,/Invalid approved SHA/);
for(const expected of [
 'sha256sum -c','validateDeployableArtifact','check-release-migrations.mjs',
 'prepare-release-env.mjs','smoke-staged-artifact.mjs',
 'systemctl restart nisvartha-api','systemctl restart nisvartha-web',
 'trap rollback EXIT','apache2ctl configtest'
])assert.ok(source.includes(expected),'Missing release safety control: '+expected);
const migrationRunner=readFileSync('scripts/deploy-production-migrations.mjs','utf8');
assert.match(migrationRunner,/NISVARTHA_UNUSED_DATABASE_CONFIRMED/,
 'Unused DB backup exception must require explicit operator confirmation');
assert.match(migrationRunner,/inspectUnusedDatabase/,
 'Unused DB backup exception must verify actual DB state');
assert.match(source,/--env-file=\/etc\/nisvartha\/api\.env/,
 'Cutover must check live MySQL history using its existing protected runtime env');
assert.doesNotMatch(source,/info\.migration_head!==old\.migration_head/,
 'Installer must not block an otherwise verified forward migration');
assert.ok(source.indexOf('check-release-migrations.mjs" "$REL" "$OLD"')<
 source.indexOf('smoke-staged-artifact.mjs" "$REL"'),
 'Migration history verification must precede even staged compiled startup');
assert.match(source,/NISVARTHA_FINANCIAL_ACCEPTANCE_APPROVED/,
 'Full finance profile requires a distinct explicit host operator acknowledgement');
assert.match(source,/client-acceptance\.tar\.gz/,
 'Only exact-SHA financial-acceptance archive may be installed');
assert.match(source,/info\.release_channel!==channel/,
 'Manifest channel must match the exact approved archive filename');
assert.match(source,/WEB_DROP_EXISTED=0/,
 'A fresh frontend systemd override must be installable without a preexisting drop-in');
assert.match(source,/rm -f "\$WEB_DROP"/,
 'Rollback must remove a newly-created frontend override');
assert.ok(source.indexOf('trap rollback EXIT')<source.indexOf('install -d -m 755 "$REL"'),
 'Staging rollback must be installed before archive extraction');
assert.match(source,/flock -n 9/,
 'Competing release operations must be locked out');
assert.ok(source.includes('STAGED=1')&&source.includes('tar --no-same-owner'),
 'Release directory must be tracked before extracting the archive');
assert.ok(source.includes('rm -rf -- "$REL"'),
 'Pre-cutover failure must remove only the newly staged release');
assert.ok(source.includes('readlink -f /srv/nisvartha/current'),
 'Never remove an active or failed-to-rollback release');
assert.ok(source.includes('/opt/nisvartha/node22/bin/node'),
 'Support documented isolated Node path');
assert.ok(source.includes('/opt/nisvartha/node-v22.23.4/bin/node'),
 'Support existing isolated Node path');
assert.ok(source.includes('ExecStart=$NODE /srv/nisvartha/current/web/server.js'),
 'Web systemd must use the checked Node executable');
assert.ok(source.includes('ExecStart=$NODE /srv/nisvartha/current/api/dist/main.js'),
 'API systemd must use the SAME checked Node executable');
assert.ok(source.includes('API_DROP_EXISTED=0'),
 'API runtime override must have an independently tracked rollback baseline');
assert.ok(source.includes('cp -a "$BACKUP/api-runtime.conf" "$API_DROP"'),
 'Rollback must restore an existing API runtime override');
assert.ok(source.includes('rm -f "$API_DROP"'),
 'Rollback must remove a newly created API runtime override');
assert.doesNotMatch(source,/Expected existing frontend runtime override missing/,
 'Installer must not fail just because an old runtime.conf drop-in never existed');
assert.doesNotMatch(source,/(?:^|\n)\s*(?:git\s|npm\s|npx\s|prisma\s+migrate)/,
 'Live installer must not build code or invoke migrations');
console.log('Compiled-only artifact deployment syntax, policy guards, rollback and fail-closed invocation: PASS');
