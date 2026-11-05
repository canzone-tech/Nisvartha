import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// Static guard only; real compiled API/MySQL/BFF flow is integration-tested.
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const service=read('backend/src/members/member.service.ts');
const controller=read('backend/src/members/member.controller.ts');
const schema=read('backend/prisma/schema.prisma');
const migration=read('backend/prisma/migrations/0010_staff_assisted_member_registration/migration.sql');
const workspace=read('frontend/components/admin-workspace.tsx');
const bff=read('frontend/app/api/admin/backend/[...path]/route.ts');
assert.match(service,/async registerAssisted\(/);
assert.match(service,/MEMBER_STAFF_REGISTRATION_ENABLED/);
assert.match(service,/return this\.register\(input,\{staffId:actor\.id/);
assert.match(service,/this\.newApplications\(\)/);
assert.match(service,/MembershipApplicationStatus\.SUBMITTED/);
assert.match(service,/MEMBER_APPLICATION_STAFF_SUBMITTED/);
assert.match(controller,/@Post\('applications\/register'\)/);
assert.match(controller,/@StaffRoles\(StaffRole\.ADMIN\)/);
assert.match(controller,/@UseGuards\(StaffGuard\)/);
assert.match(workspace,/StaffAssistedRegistrationPanel/);
assert.match(workspace,/MEMBER_STAFF_REGISTRATION_ENABLED/);
assert.match(workspace,/REGISTRATION_ACCESS_PIN_ENABLED/);
assert.ok(bff.includes('/register|'),'BFF route must explicitly allow staff signup');
assert.match(schema,/enum MemberRegistrationSource \{/);
assert.match(schema,/registrationSource MemberRegistrationSource @default\(PUBLIC\)/);
assert.match(schema,/registeredByStaffId String\? @db\.Char\(36\)/);
assert.match(schema,/consentEvidenceRef String\? @db\.VarChar\(120\)/);
assert.match(migration,/ALTER TABLE/);
assert.match(migration,/membership_applications/);
assert.ok(!migration.includes('\\`'),'SQL backticks must never have escape slashes');
assert.doesNotMatch(migration,/CREATE TABLE/i);
for(const file of ['scripts/verify-local.sh','scripts/verify-web-local.sh','scripts/local-uat.sh']){
 assert.match(read(file),/MEMBER_STAFF_REGISTRATION_ENABLED=false/);
}
console.log('Shared nonfinancial public/staff registration, consent, audit and feature gates: PASS');
