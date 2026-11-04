import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readdirSync,readFileSync,statSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=mkdtempSync(join(tmpdir(),'nisvartha-epin-cli-fixture-'));
const script=fileURLToPath(new URL('./uat-epin-candidates.mjs',import.meta.url));
const env={...process.env,TMPDIR:root,NODE_ENV:'',
 NISVARTHA_UAT_EPINS:'UNISSUED_ONLY'};
const run=(args,overrides={})=>spawnSync(process.execPath,[script,...args],{
 env:{...env,...overrides},encoding:'utf8',timeout:15000
});
const valid=['--quantity=20','--expires-at=2099-01-31T23:59:00+05:30'];
const names=()=>readdirSync(root);
try{
 for(const [args,overrides] of [
  [valid,{NISVARTHA_UAT_EPINS:''}],
  [valid,{NODE_ENV:'production'}],
  [['--quantity=0',valid[1]],{}],
  [['--quantity=501',valid[1]],{}],
  [['--quantity=1','--expires-at=invalid'],{}],
  [['--quantity=1','--quantity=2'],{}],
  [['--quantity=1'],{}],
  [['--quantity=1','--expires-at=2099-01-31T23:59:00'],{}],
 ]){
  const result=run(args,overrides);
  assert.notEqual(result.status,0,'Unsafe input unexpectedly generated test material');
  assert.deepEqual(names(),[],'Rejected input must not create a file');
 }
 const result=run(valid);
 assert.equal(result.status,0,'Opted-in local candidate generation failed: '+result.stderr);
 assert.match(result.stdout,/NOT VALID FOR SIGNUP/);
 const match=/Private test file: (.+)/.exec(result.stdout);
 assert.ok(match,'Private test file location not reported');
 const file=match[1];
 assert.ok(file.startsWith(root+'/nisvartha-unissued-epin-'),'Output escaped test TMPDIR');
 assert.equal(statSync(file).mode&0o777,0o600,'Candidate secrets must be owner-readable only');
 assert.equal(statSync(join(file,'..')).mode&0o777,0o700);
 const data=JSON.parse(readFileSync(file,'utf8'));
 assert.equal(data.classification,'UNISSUED_TEST_CANDIDATES_NOT_VALID_FOR_SIGNUP');
 assert.equal(data.purpose,'SYNTHETIC_NONFINANCIAL_UAT');
 assert.equal(data.quantity,20);
 assert.equal(data.expiresAt,'2099-01-31T18:29:00.000Z');
 assert.equal(data.candidates.length,20);
 const codes=new Set();
 for(const candidate of data.candidates){
  assert.deepEqual(Object.keys(candidate).sort(),['code','displaySuffix']);
  assert.match(candidate.code,/^[A-Za-z0-9_-]{43}$/);
  assert.equal(Buffer.from(candidate.code,'base64url').length,32);
  assert.equal(candidate.displaySuffix,candidate.code.slice(-6));
  assert.ok(!codes.has(candidate.code),'Duplicated candidate secret');
  assert.ok(!result.stdout.includes(candidate.code),'Credential leaked to terminal output');
  codes.add(candidate.code);
 }
 assert.ok(!JSON.stringify(data).includes('codeHash'),'Do not write digest beside plaintext');
 assert.ok(!JSON.stringify(data).includes('settlement'),'Do not invent settlement');
 const next=run(['--quantity=1',valid[1]]);
 assert.equal(next.status,0,next.stderr);
 const secondFile=/Private test file: (.+)/.exec(next.stdout)?.[1];
 assert.ok(secondFile&&secondFile!==file,'Runs must never overwrite prior file');
 const second=JSON.parse(readFileSync(secondFile,'utf8'));
 assert.ok(!codes.has(second.candidates[0].code),'Random secrets must differ across runs');
 console.log('Nisvartha opt-in synthetic E-PIN CLI: strict input, unique entropy, secret isolation, private file, no issuance: PASS');
}finally{
 rmSync(root,{force:true,recursive:true,maxRetries:10,retryDelay:50});
}
