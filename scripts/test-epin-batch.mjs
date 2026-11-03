import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const compiled=new URL('../backend/dist/security/epin-batch.js',import.meta.url);
assert.ok(existsSync(compiled),'Compiled E-PIN batch module missing');
const {prepareEpinBatch}=require(compiled.pathname);

const {validateEpinBatchRequest}=require(compiled.pathname);
const preflight=validateEpinBatchRequest({quantity:5,pinType:'ACTIVATION',
 expiresAt:'2027-01-01T00:00:00Z'},new Date('2026-11-02T00:00:00Z'));
assert.deepEqual(preflight,{quantity:5,pinType:'ACTIVATION',expiresAt:'2027-01-01T00:00:00.000Z'});
assert.deepEqual(Object.keys(preflight).sort(),['expiresAt','pinType','quantity'],
 'Preflight must never generate codes, digests, IDs or active states');
assert.throws(()=>validateEpinBatchRequest({quantity:1,pinType:null,expiresAt:'2027-01-01T00:00:00Z'},
 new Date('2026-11-02T00:00:00Z')),TypeError);

const {hashOpaqueCredential}=require(new URL('../backend/dist/security/opaque-credential.js',import.meta.url).pathname);

const now=new Date('2026-11-02T00:00:00.000Z');
const req={quantity:500,pinType:'ACTIVATION',expiresAt:'2026-12-15T10:30:00+05:30'};
const batch=prepareEpinBatch(req,now);
assert.equal(batch.length,500,'MEGA-compatible bounded batch limit');
assert.equal(new Set(batch.map(x=>x.id)).size,500,'Unique candidate ids');
assert.equal(new Set(batch.map(x=>x.code)).size,500,'Unique candidate bearer secrets');
assert.equal(new Set(batch.map(x=>x.codeHash)).size,500,'Unique candidate digests');
for(const pin of batch){
 assert.match(pin.id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
 assert.match(pin.code,/^[A-Za-z0-9_-]{43}$/);
 assert.equal(Buffer.from(pin.code,'base64url').length,32);
 assert.equal(pin.codeHash,hashOpaqueCredential('epin-activation',pin.code));
 assert.notEqual(pin.codeHash,hashOpaqueCredential('member-recovery',pin.code),
  'E-PIN cannot collide with recovery credential namespace');
 assert.equal(pin.displaySuffix,pin.code.slice(-6));
 assert.equal(pin.pinType,'ACTIVATION');
 assert.equal(pin.expiresAt,'2026-12-15T05:00:00.000Z');
 assert.ok(!('status' in pin),'Unissued candidates must not imply active status');
 assert.ok(!('amount' in pin),'Unapproved financial values must not be invented');
}
assert.throws(()=>prepareEpinBatch({quantity:1,pinType:'INSTALLMENT',
 expiresAt:'2027-02-28T00:00:00Z'},now),TypeError,
 'MEGA installment PIN must not be accepted for one-time Nisvartha registration');
assert.equal(prepareEpinBatch({quantity:1,expiresAt:'2027-01-01T00:00:00Z'},now)[0].pinType,'ACTIVATION');

for(const quantity of [0,-1,501,1.5,'1',NaN,Infinity]){
 assert.throws(()=>prepareEpinBatch({quantity,expiresAt:req.expiresAt},now),
  'Out-of-bounds or noninteger batch accepted: '+quantity);
}
for(const pinType of ['UNKNOWN','PAYMENT','activation','INSTALLMENT','INSTALLMENT ',null,1]){
 assert.throws(()=>prepareEpinBatch({quantity:1,pinType,expiresAt:req.expiresAt},now),
  'Unapproved E-PIN kind accepted: '+String(pinType));
}
for(const expiry of ['2027-02-29T00:00:00Z','2027-13-01T00:00:00Z',
 '2027-01-01','2027-01-01T00:00:00','2027-01-01T24:00:00Z',
 '2027-01-01T00:00:60Z','2027-01-01T00:00:00+25:00',
 '2027-01-01T00:00:00+01:99','2026-11-02T00:00:00Z',
 '2026-11-01T23:59:59Z','invalid',null,13]){
 assert.throws(()=>prepareEpinBatch({quantity:1,expiresAt:expiry},now),
  'Malformed, ambiguous or expired date accepted: '+String(expiry));
}
assert.throws(()=>prepareEpinBatch(null,now));
assert.throws(()=>prepareEpinBatch(req,new Date('invalid')));

// Regression boundary: only an internal security module, not a paid generator API.
// A future vetted service must independently persist and audit one-use issuance.
const source=readFileSync(new URL('../backend/src/security/epin-batch.ts',import.meta.url),'utf8');
assert.doesNotMatch(source,/^import .*@(?:prisma|nestjs)\//m,'Batch core must not couple to DB/controllers');
assert.doesNotMatch(source,/@(?:Controller|Post|Get|Patch)\(/,'No E-PIN route before SRS approval');
console.log('Registration-only E-PIN batch candidate contract: types, 500 max, 256-bit unique secrets, isolation, UTC expiry, validation, HOLD: PASS');
