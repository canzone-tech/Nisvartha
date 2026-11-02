import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const compiled=new URL('../backend/dist/security/epin-redemption-preconditions.js',import.meta.url);
assert.ok(existsSync(compiled),'Compiled E-PIN preconditions module missing');
const {assertEpinRedemptionPreconditions,EpinRedemptionPreconditionError}=require(compiled.pathname);

const now=new Date('2026-11-02T10:00:00.000Z');
const context={memberId:'member-alpha',expectedSessionId:'session-2026',expectedType:'ACTIVATION',now};
const base=()=>({
 status:'ACTIVE',pinType:'ACTIVATION',
 expiresAt:new Date('2026-12-01T00:00:00.000Z'),usedAt:null,revokedAt:null,
 assignedMemberId:null,sessionId:'session-2026',
 sessionStatus:'ACTIVE',programLifecycle:'PUBLISHED',
 currencyCodeSnapshot:'INR',sessionCurrencyCode:'INR',
 registrationFeeSnapshot:'0.00',installmentAmountSnapshot:'1.00',installmentCount:1
});
assert.doesNotThrow(()=>assertEpinRedemptionPreconditions(base(),context));
assert.equal(assertEpinRedemptionPreconditions(base(),context),undefined,
 'Metadata check must not issue bearer, payment receipt or activation state');
assert.doesNotThrow(()=>assertEpinRedemptionPreconditions({
 ...base(),assignedMemberId:context.memberId
},context),'Correct assigned beneficiary denied');
assert.doesNotThrow(()=>assertEpinRedemptionPreconditions({
 ...base(),pinType:'INSTALLMENT'
},{...context,expectedType:'INSTALLMENT'}),'Valid installment metadata denied');
assert.doesNotThrow(()=>assertEpinRedemptionPreconditions({
 ...base(),expiresAt:'2026-12-01T00:00:00Z'
},context),'Valid canonical UTC metadata rejected');

function rejects(change,code,override={}){
 let err;
 try{assertEpinRedemptionPreconditions(
  change===undefined?undefined:{...base(),...change},{...context,...override}
 )}catch(e){err=e}
 assert.ok(err instanceof EpinRedemptionPreconditionError,
  'Invalid metadata must produce typed, fail-closed error: '+JSON.stringify(change));
 assert.equal(err.code,code,'Incorrect precondition denial');
 assert.equal(err.message,'E-PIN cannot be redeemed',
  'Public-safe error must not leak whether PIN is missing, assigned, revoked or expired');
}
rejects(undefined,'NOT_ACTIVE');
for(const variation of [
 {status:'REVOKED'},{status:'USED'},{status:'PENDING'},
 {usedAt:now},{revokedAt:now},
 {expiresAt:now},{expiresAt:new Date('2026-11-01T00:00:00Z')},
 {expiresAt:new Date('invalid')},{expiresAt:'2027-02-29T00:00:00Z'},
 {expiresAt:'2027-01-01T00:00:00'},{expiresAt:'invalid'},
 {expiresAt:null},{status:null},{usedAt:undefined}
])rejects(variation,'NOT_ACTIVE');
rejects({pinType:'INSTALLMENT'},'WRONG_TYPE');
rejects({pinType:'unknown'},'WRONG_TYPE');
rejects({assignedMemberId:'member-beta'},'WRONG_MEMBER');
rejects({assignedMemberId:undefined},'WRONG_MEMBER');
rejects({sessionId:'another-session'},'WRONG_SESSION');
rejects({sessionId:null},'WRONG_SESSION');
rejects({sessionStatus:'SUSPENDED'},'SESSION_UNAVAILABLE');
rejects({programLifecycle:'DRAFT'},'SESSION_UNAVAILABLE');
for(const variation of [
 {currencyCodeSnapshot:null},{currencyCodeSnapshot:'inr'},
 {currencyCodeSnapshot:'INRR'},{sessionCurrencyCode:null},
 {registrationFeeSnapshot:null},{installmentAmountSnapshot:null},
 {registrationFeeSnapshot:'NaN'},{installmentAmountSnapshot:'-1.00'},
 {installmentAmountSnapshot:'1e10'},{installmentCount:0},
 {installmentCount:1.5},{installmentCount:null},
 {installmentCount:undefined}
])rejects(variation,'INVALID_SNAPSHOT');
rejects({sessionCurrencyCode:'USD'},'CURRENCY_MISMATCH');
assert.throws(()=>assertEpinRedemptionPreconditions(base(),{...context,now:new Date('invalid')}),TypeError);
assert.throws(()=>assertEpinRedemptionPreconditions(base(),{...context,memberId:''}),TypeError);
assert.throws(()=>assertEpinRedemptionPreconditions(base(),{...context,expectedSessionId:''}),TypeError);
assert.throws(()=>assertEpinRedemptionPreconditions(base(),{...context,expectedType:'WITHDRAWAL'}),TypeError);

// This is a pure contract: no database, HTTP API, issued secret or compensation.
const code=readFileSync(new URL('../backend/src/security/epin-redemption-preconditions.ts',import.meta.url),'utf8');
assert.doesNotMatch(code,/@(?:Controller|Post|Patch|Get)\(/);
assert.doesNotMatch(code,/^import .*@(?:prisma|nestjs)\//m);
assert.doesNotMatch(code,/\b(?:create|update|delete|executeRaw|queryRaw|generateOpaqueCredential|prepareEpinBatch)\s*\(/);
console.log('MEGA E-PIN redemption metadata: active/expiry/type/member/session/snapshot denials, zero mutation: PASS');
