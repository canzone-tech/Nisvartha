import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
const require=createRequire(import.meta.url);
const artifact=new URL('../backend/dist/security/opaque-credential.js',import.meta.url);
assert.ok(existsSync(artifact),'Compiled security primitive missing; run clean backend build');
const {generateOpaqueCredential,hashOpaqueCredential}=require(artifact.pathname);

const sample=generateOpaqueCredential();
assert.match(sample,/^[A-Za-z0-9_-]{43}$/,'Credential must be 32 bytes base64url');
assert.equal(Buffer.from(sample,'base64url').byteLength,32,'Entropy source must be 256 bits');
const issued=new Set();
for(let i=0;i<2048;i++){
 const value=generateOpaqueCredential();
 assert.match(value,/^[A-Za-z0-9_-]{43}$/);
 assert.equal(Buffer.from(value,'base64url').length,32);
 assert.ok(!issued.has(value),'Credential collision');
 issued.add(value);
}
const prior=hashOpaqueCredential('member-recovery',sample);
assert.equal(prior,createHash('sha256').update('nisvartha:member-recovery:v1:'+sample).digest('hex'),
 'Refactor must not invalidate previously issued recovery credentials');
assert.match(prior,/^[a-f0-9]{64}$/);
assert.notEqual(hashOpaqueCredential('future-separate-purpose',sample),prior,
 'A purpose-specific bearer must not verify in another domain');
assert.notEqual(hashOpaqueCredential('member-recovery',generateOpaqueCredential()),prior);
for(const bad of ['', 'MEMBER_RECOVERY','../member-recovery','member recovery','x'.repeat(65)]){
 assert.throws(()=>hashOpaqueCredential(bad,sample),TypeError,'Unsafe purpose accepted: '+bad);
}
for(const bad of ['', 'abc', 'a'.repeat(42), 'a'.repeat(44), 'x'.repeat(42)+'+']){
 assert.throws(()=>hashOpaqueCredential('member-recovery',bad),TypeError,'Malformed bearer accepted');
}
assert.notEqual(hashOpaqueCredential('member-recovery',randomBytes(32).toString('base64url')),prior);
console.log('Opaque one-time credential: 256-bit entropy, canonical encoding, domain separation, legacy recovery hash parity: PASS');
