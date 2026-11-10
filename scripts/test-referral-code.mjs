import assert from 'node:assert/strict';
import {generateReferralCode,normalizeReferralCode,REFERRAL_CODE_PATTERN,validReferralCode} from '../backend/src/members/referral-code.ts';
const issued=Array.from({length:500},()=>generateReferralCode());
assert.ok(issued.every(code=>REFERRAL_CODE_PATTERN.test(code)),'Referral codes must be 8 uppercase alphanumeric characters');
assert.ok(new Set(issued).size>=499,'Referral RNG produced too many collisions');
assert.equal(normalizeReferralCode(' ab7k29xq '),'AB7K29XQ');
assert.ok(validReferralCode('AB7K29XQ'));
assert.ok(validReferralCode('abcdefghijklmnopqrstuv'),'Previously issued 22-character codes remain valid');
for(const bad of ['','1234567','ABCDEFGHIJKLMNOP','AB#K29XQ','ABCDEFGHIJKLMNO']){
 assert.ok(!validReferralCode(bad),'Invalid referral code accepted: '+bad);
}
console.log('M3 cryptographic 8-character referral codes, case normalization and legacy compatibility: PASS');
