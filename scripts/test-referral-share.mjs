import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {referralLink,whatsappReferralShareUrl,INVITE_CODE_PATTERN} from '../frontend/lib/referral-share.ts';
const code=randomBytes(16).toString('base64url');
assert.match(code,INVITE_CODE_PATTERN);
const origin='https://nisvarthafoundation.in';
const link=referralLink(origin,code);
assert.equal(link,origin+'/member/register?invite='+code);
assert.equal(referralLink('http://127.0.0.1:3102',code),
 'http://127.0.0.1:3102/member/register?invite='+code);
const whats=whatsappReferralShareUrl(link);
const target=new URL(whats);
assert.equal(target.origin,'https://wa.me');
assert.equal(target.pathname,'/');
const message=target.searchParams.get('text')||'';
assert.ok(message.includes(link),'WhatsApp share must carry the same inviter URL');
assert.match(message,/separate E-PIN/);
assert.match(message,/no income|no commission|No income|No commission/);
assert.doesNotMatch(message,/₹|15,000|1,000|guaranteed earnings/i);
for(const invalid of ['', 'abc',code+'x','../member',code.slice(0,21)+'%']){
 assert.throws(()=>referralLink(origin,invalid),TypeError,'Invalid inviter code accepted');
}
for(const invalidOrigin of [
 'javascript:alert(1)','https://example.org/path',
 'https://member:secret@example.org','https://example.org/?code=test'
]) assert.throws(()=>referralLink(invalidOrigin,code),TypeError,'Unsafe origin accepted');
for(const bad of [
 'javascript:alert(1)','https://example.org/member/register?invite=broken',
 'https://example.org/member/register?invite='+code+'&registrationPin=SECRET',
 'https://example.org/member/login?invite='+code
])assert.throws(()=>whatsappReferralShareUrl(bad),TypeError,'Unsafe WhatsApp target accepted');
console.log('Referral URL encode/validate, WhatsApp handoff, no PIN leakage and UAT boundary: PASS');
