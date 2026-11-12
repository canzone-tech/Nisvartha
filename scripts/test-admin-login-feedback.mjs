import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {adminLoginErrorMessage} from '../frontend/lib/admin-login-feedback.ts';

const throttled=adminLoginErrorMessage(429);
assert.match(throttled,/Too many sign-in attempts/);
assert.match(throttled,/15 minutes/);
const unauthenticated=adminLoginErrorMessage(401);
assert.match(unauthenticated,/email and password/);
assert.match(unauthenticated,/may be locked for 15 minutes/);
assert.match(adminLoginErrorMessage(403),/request was blocked/);
assert.match(adminLoginErrorMessage(502),/temporarily unavailable/);
assert.match(adminLoginErrorMessage(503),/temporarily unavailable/);
assert.match(adminLoginErrorMessage(400),/check your details/);
assert.notEqual(throttled,unauthenticated,'429 must not be indistinguishable from 401');
for (const status of [400,401,403,429,500,502,503]) {
  assert.doesNotMatch(adminLoginErrorMessage(status),/account exists|locked until|admin@/i,
    'Anonymous sign-in error must not disclose account-specific information');
}
const form=readFileSync(new URL('../frontend/components/admin-login-form.tsx',import.meta.url),'utf8');
assert.match(form,/adminLoginErrorMessage\(res\.status\)/,
  'Admin form must use HTTP status-aware feedback');
assert.match(form,/role="alert"/,'Admin login errors need an accessible alert');
const bff=readFileSync(new URL('../frontend/app/api/admin/session/login/route.ts',import.meta.url),'utf8');
assert.match(bff,/status:backend\.status/,
  'Admin BFF must preserve backend 401/429 status for safe feedback');
console.log('Admin login: distinct 401/429 guidance, safe status mapping and accessible error display PASS');
