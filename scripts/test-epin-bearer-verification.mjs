import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const compiled=new URL('../backend/dist/security/epin-bearer-verification.js',import.meta.url);
assert.ok(existsSync(compiled),'Compiled E-PIN bearer verification artifact missing');
const {matchesEpinBearer}=require(compiled.pathname);
const {prepareEpinBatch}=require(new URL('../backend/dist/security/epin-batch.js',import.meta.url).pathname);
const {hashOpaqueCredential,generateOpaqueCredential}=
 require(new URL('../backend/dist/security/opaque-credential.js',import.meta.url).pathname);
const {assertEpinRedemptionPreconditions,EpinRedemptionPreconditionError}=
 require(new URL('../backend/dist/security/epin-redemption-preconditions.js',import.meta.url).pathname);

const fixedNow=new Date('2026-11-02T10:00:00.000Z');
const activation=prepareEpinBatch({quantity:1,pinType:'ACTIVATION',
 expiresAt:'2027-04-01T00:00:00Z'},fixedNow)[0];
// Only one registration-time PIN exists. Legacy MEGA INSTALLMENT never verifies.
assert.equal(activation.codeHash,hashOpaqueCredential('epin-activation',activation.code));
assert.equal(matchesEpinBearer(activation.codeHash,activation.code,'ACTIVATION'),true);
assert.equal(matchesEpinBearer(activation.codeHash,activation.code,'INSTALLMENT'),false);
assert.equal(matchesEpinBearer(
 hashOpaqueCredential('member-recovery',activation.code),activation.code,'ACTIVATION'),false,
 'Member recovery credential digest must not become a PIN digest');
assert.equal(matchesEpinBearer(
 hashOpaqueCredential('epin-installment',activation.code),activation.code,'ACTIVATION'),false,
 'Cross-type digest must never verify');

// Valid-length but wrong high-entropy bearer must not verify.
for(let i=0;i<128;i++){
 const randomCode=generateOpaqueCredential();
 assert.equal(matchesEpinBearer(activation.codeHash,randomCode,'ACTIVATION'),false);
}
for(const supplied of [undefined,null,1,{},'',activation.code+'=',activation.code+' ',
 ' '.repeat(43),'é'.repeat(43),'A'.repeat(43),'A'.repeat(42),
 'A'.repeat(44),'A'.repeat(100000)]){
 assert.equal(matchesEpinBearer(activation.codeHash,supplied,'ACTIVATION'),false,
  'Malformed or non-canonical bearer must be rejected');
}
for(const hash of [undefined,null,0,{},'',activation.codeHash.toUpperCase(),
 'g'.repeat(64),'0'.repeat(63),'0'.repeat(65),'0'.repeat(100000)]){
 assert.equal(matchesEpinBearer(hash,activation.code,'ACTIVATION'),false,
  'Malformed stored digest must not be accepted or throw');
}
assert.equal(matchesEpinBearer(activation.codeHash,activation.code,'INVALID'),false);
assert.equal(matchesEpinBearer(activation.codeHash,activation.code,undefined),false);

// Noncanonical base64url has same decoded bytes but must not match original.
// 32 bytes encode to 43 chars with two unused low bits in the last character.
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const last=alphabet.indexOf(activation.code.at(-1));
assert.ok(last>=0);
const alternate=activation.code.slice(0,-1)+alphabet[(last&~3)|((last+1)&3)];
assert.notEqual(alternate,activation.code);
assert.deepEqual(Buffer.from(alternate,'base64url'),Buffer.from(activation.code,'base64url'));
assert.equal(matchesEpinBearer(activation.codeHash,alternate,'ACTIVATION'),false,
 'Noncanonical base64url with same underlying bytes must be rejected');

// Synthetic metadata-only replay example; this does NOT perform a DB claim,
// row lock, settlement or actual single-use redemption.
const context={memberId:'synthetic-member',expectedSessionId:'synthetic-session',
 expectedType:'ACTIVATION',now:fixedNow};
const record={
 status:'ACTIVE',pinType:'ACTIVATION',expiresAt:activation.expiresAt,
 usedAt:null,revokedAt:null,assignedMemberId:context.memberId,
 sessionId:context.expectedSessionId,sessionStatus:'ACTIVE',programLifecycle:'PUBLISHED',
 currencyCodeSnapshot:'INR',sessionCurrencyCode:'INR',
 registrationFeeSnapshot:'0.00'
};
assert.equal(matchesEpinBearer(activation.codeHash,activation.code,'ACTIVATION'),true);
assert.equal(assertEpinRedemptionPreconditions(record,context),undefined);
assert.throws(()=>assertEpinRedemptionPreconditions({
 ...record,status:'USED',usedAt:fixedNow
},context),EpinRedemptionPreconditionError,
 'A hypothetical already-used record must fail the existing replay precondition');
assert.throws(()=>assertEpinRedemptionPreconditions({
 ...record,status:'REVOKED',revokedAt:fixedNow
},context),EpinRedemptionPreconditionError,
 'A revoked record must fail even if the bearer digest is valid');

// Test the exact one-way, no-side-effect module boundary as well.
const source=readFileSync(new URL('../backend/src/security/epin-bearer-verification.ts',import.meta.url),'utf8');
assert.match(source,/timingSafeEqual/,'Digest comparison must use timing-safe bytes');
assert.match(source,/hashOpaqueCredential/,'Must reuse existing purpose-separated hash');
assert.doesNotMatch(source,/^import .*@(?:prisma|nestjs)\//m,
 'Verifier must not access DB or HTTP frameworks');
assert.doesNotMatch(source,/@(?:Controller|Post|Get|Patch|Put|Delete)\(/,
 'Verifier must not expose a financial endpoint');
assert.doesNotMatch(source,/\b(?:prepareEpinBatch|generateOpaqueCredential|create|update|delete|executeRaw|queryRaw)\s*\(/,
 'Verifier must not issue or persist a bearer');
console.log('Registration-only E-PIN bearer: canonical 256-bit token, purpose-bound digest, constant-time comparison, negative/replay contracts and no writes: PASS');
