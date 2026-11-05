import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
const require=createRequire(import.meta.url);
const artifact=new URL('../backend/dist/security/pin-vault.js',import.meta.url);
assert.ok(existsSync(artifact),'Compile backend before PIN encryption regression');
const {sealRegistrationCode,unsealRegistrationCode}=require(artifact.pathname);
const code=randomBytes(32).toString('base64url');
const id=randomUUID(),id2=randomUUID();
const purpose='registration-access',other='uat-signup';
const first=sealRegistrationCode(purpose,id,code);
const second=sealRegistrationCode(purpose,id,code);
assert.match(first,/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
assert.notEqual(first,second,'Nonce reuse during repeated encryption');
assert.ok(!first.includes(code),'Plaintext code leaked into sealed storage');
assert.equal(unsealRegistrationCode(purpose,id,first),code);
assert.equal(unsealRegistrationCode(purpose,id,second),code);
assert.throws(()=>unsealRegistrationCode(other,id,first),'Cross-domain decryption allowed');
assert.throws(()=>unsealRegistrationCode(purpose,id2,first),'Cross-record ciphertext transplant allowed');
const segments=first.split('.');
const changed=segments[2].slice(0,-1)+(segments[2].at(-1)==='A'?'B':'A');
assert.throws(()=>unsealRegistrationCode(purpose,id,[segments[0],segments[1],changed,segments[3]].join('.')),
 'Ciphertext tamper accepted');
const original=process.env.PIN_VAULT_KEY;
try{
 process.env.PIN_VAULT_KEY=randomBytes(32).toString('base64url');
 assert.throws(()=>unsealRegistrationCode(purpose,id,first),'Wrong key decrypted PIN');
 delete process.env.PIN_VAULT_KEY;
 assert.throws(()=>sealRegistrationCode(purpose,id,code),'Missing vault key issued PIN');
 process.env.PIN_VAULT_KEY='short';
 assert.throws(()=>sealRegistrationCode(purpose,id,code),'Weak vault key issued PIN');
}finally{
 if(original===undefined)delete process.env.PIN_VAULT_KEY;
 else process.env.PIN_VAULT_KEY=original;
}
assert.equal(unsealRegistrationCode(purpose,id,first),code);
console.log('AES-256-GCM PIN vault, identity binding, purpose isolation, tampering, missing/wrong key: PASS');
