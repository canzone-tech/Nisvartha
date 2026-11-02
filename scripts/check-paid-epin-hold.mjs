import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';

// Defense-in-depth SRS scope regression, not a substitute for legal sign-off.
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const expectedMigrations = [
  '0001_public_enquiries', '0002_staff_cms', '0003_enquiry_cases',
  '0004_event_details', '0005_local_media_gallery', '0006_media_evidence_refs',
  '0007_member_accounts', '0008_member_password_recovery',
  '0009_staff_super_admin_role',
];

export function assertPaidEpinHeld({schema, service, controller, migrations, memberFiles}) {
  assert.match(schema, /model\s+MemberAccount\s*\{/);
  assert.match(schema, /model\s+MembershipApplication\s*\{/);
  assert.doesNotMatch(
    schema,
    /\bmodel\s+(?:PaidActivationPin|MemberActivationPin|MemberEpin|MemberOrder|MembershipOrder|MemberPayment|MembershipPayment|PaymentAttempt|PaymentSettlement|ReferralReward|CommissionLedger|MemberWallet|MemberGenealogy)\s*\{/i,
    'Paid E-PIN/payment/compensation tables require signed scope and legal review',
  );
  assert.deepEqual(migrations, expectedMigrations, 'Unexpected migration: paid financial scope is on HOLD');
  assert.match(service, /MEMBER_PORTAL_ENABLED/);
  assert.match(service, /MEMBER_APPLICATIONS_ENABLED/);
  assert.match(service, /MembershipApplicationStatus\.SUBMITTED/);
  assert.doesNotMatch(
    service,
    /\b(?:tx|this\.db)\.(?:paidActivationPin|memberActivationPin|memberEpin|memberOrder|membershipOrder|memberPayment|membershipPayment|paymentAttempt|paymentSettlement|memberWallet|memberGenealogy)\b/i,
    'Member service cannot create financial records or redeem paid activation PINs',
  );
  assert.doesNotMatch(
    controller,
    /@(?:Get|Post|Patch|Put|Delete)\(['"](?:epin|e-pin|activation-pin|paid-activation|checkout|payment|wallet|payout)/i,
    'Unapproved paid E-PIN/payment route detected',
  );
  assert.ok(
    memberFiles.every(name => !/(?:^|[-_.])(?:epin|e-pin|payment|checkout|commission|payout|genealogy)(?:[-_.]|$)/i.test(name)),
    'Unapproved member-domain financial module detected',
  );
}

const fixture = overrides => ({
  schema: 'model MemberAccount { id String @id }\nmodel MembershipApplication { id String @id }',
  service: 'MEMBER_PORTAL_ENABLED MEMBER_APPLICATIONS_ENABLED MembershipApplicationStatus.SUBMITTED',
  controller: "@Post('register')",
  migrations: expectedMigrations,
  memberFiles: ['member.service.ts', 'member.controller.ts', 'recovery.service.ts'],
  ...overrides,
});
assert.doesNotThrow(() => assertPaidEpinHeld(fixture()));
assert.throws(() => assertPaidEpinHeld(fixture({schema: fixture().schema + '\nmodel PaidActivationPin { id String @id }'})));
assert.throws(() => assertPaidEpinHeld(fixture({service: fixture().service + '\nawait tx.memberPayment.create({})'})));
assert.throws(() => assertPaidEpinHeld(fixture({controller: fixture().controller + "\n@Post('epin/redeem')"})));
assert.throws(() => assertPaidEpinHeld(fixture({memberFiles: ['epin.controller.ts']})));
assert.throws(() => assertPaidEpinHeld(fixture({migrations: [...expectedMigrations, '0009_paid_epin']})));

assertPaidEpinHeld({
  schema: read('backend/prisma/schema.prisma'),
  service: read('backend/src/members/member.service.ts'),
  controller: read('backend/src/members/member.controller.ts'),
  migrations: readdirSync(new URL('backend/prisma/migrations/', root), {withFileTypes: true})
    .filter(entry => entry.isDirectory()).map(entry => entry.name).sort(),
  memberFiles: readdirSync(new URL('backend/src/members/', root)).filter(name => name.endsWith('.ts')),
});
// The MEGA-aligned candidate factory is explicitly nonfinancial and unexposed.
const candidateCore=read('backend/src/security/epin-batch.ts');
assert.match(candidateCore,/export function prepareEpinBatch/);
assert.doesNotMatch(candidateCore,/^import .*@(?:prisma|nestjs)\\//m,
 'Pre-issuance batch core must not access database/controllers');
assert.doesNotMatch(candidateCore,/@(?:Controller|Post|Get|Patch)\\(/,
 'Unapproved issuance HTTP endpoints must remain absent');
assert.doesNotMatch(read('backend/src/app.module.ts'),/\\bEpin(?:Controller|Module|Service)\\b/,
 'No paid E-PIN provider mounted while SRS financial HOLD applies');
console.log('Paid E-PIN HOLD scope gate and negative regression fixtures: PASS');
