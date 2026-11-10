import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const installer='scripts/deploy-compiled-apache.sh';
const source=readFileSync(installer,'utf8');
for(const path of [
 installer,'scripts/prepare-release-env.mjs','scripts/smoke-staged-artifact.mjs'
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
 'sha256sum -c','validateClientReviewArtifact','migration_head',
 'prepare-release-env.mjs','smoke-staged-artifact.mjs',
 'systemctl restart nisvartha-api','systemctl restart nisvartha-web',
 'trap rollback EXIT','apache2ctl configtest'
])assert.ok(source.includes(expected),'Missing release safety control: '+expected);
assert.match(source,/WEB_DROP_EXISTED=0/,
 'A fresh frontend systemd override must be installable without a preexisting drop-in');
assert.match(source,/rm -f "\$WEB_DROP"/,
 'Rollback must remove a newly-created frontend override');
assert.doesNotMatch(source,/Expected existing frontend runtime override missing/,
 'Installer must not fail just because an old runtime.conf drop-in never existed');
assert.doesNotMatch(source,/(?:^|\n)\s*(?:git\s|npm\s|npx\s|prisma\s+migrate)/,
 'Live installer must not build code or invoke migrations');
console.log('Compiled-only artifact deployment syntax, policy guards, rollback and fail-closed invocation: PASS');
