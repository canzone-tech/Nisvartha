import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';

// Defense-in-depth SRS scope regression, not a substitute for legal sign-off.
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const expectedMigrations = [
  '0001_public_enquiries', '0002_staff_cms', '0003_enquiry_cases',
  '0004_event_details', '0005_local_media_gallery', '0006_media_evidence_refs',
  '0007_member_accounts', '0008_member_password_recovery',
  '0009_staff_super_admin_role', '0010_staff_assisted_member_registration',
  '0011_synthetic_pin_invitation', '0012_enquiry_phone','0013_sandbox_policy_revisions','0014_admin_only_accounts', '0015_nonfinancial_registration_pins','0016_encrypted_admin_pin_visibility', '0017_local_uat_scenario_events', '0018_owner_confirmed_uat_source','0019_offline_donation_register','0020_donation_refund_reconciliation','0021_nonfinancial_matrix_positions','0022_offline_sale_earnings_rebirth','0023_unique_settlement_reference','0024_member_wallet_payout_requests','0025_optional_registration_pin_expiry','0026_unique_member_mobile','0027_suspended_level4_rebirth_skip','0028_wallet_any_positive_paise','0029_member_payout_destinations','0030_registration_pin_cancellation_refunds','0031_pin_refund_shared_transfer_registry','0032_verified_paid_pin_batches','0033_staff_first_login_password_rotation',
];

export function assertPaidEpinHeld({schema, service, controller, migrations, memberFiles}) {
  assert.match(schema, /model\s+MemberAccount\s*\{/);
  assert.match(schema, /model\s+MembershipApplication\s*\{/);
  assert.doesNotMatch(
    schema,
    /\bmodel\s+(?:PaymentAttempt|PaymentGatewaySession|MemberWallet)\s*\{/i,
    'Online gateway/wallet tables are outside the offline settlement design',
  );
  assert.deepEqual(migrations, expectedMigrations, 'Unexpected migration outside approved offline-member flow');
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
    /@(?:Get|Post|Patch|Put|Delete)\(['"](?:epin|e-pin|activation-pin|paid-activation|checkout|payment)/i,
    'Unapproved paid E-PIN/payment route detected',
  );
  assert.ok(
    memberFiles.every(name => name==='genealogy.service.ts'||!/(?:^|[-_.])(?:epin|e-pin|payment|checkout|commission|payout|genealogy)(?:[-_.]|$)/i.test(name)),
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
assert.throws(() => assertPaidEpinHeld(fixture({schema: fixture().schema + '\nmodel PaymentGatewaySession { id String @id }'})));
assert.throws(() => assertPaidEpinHeld(fixture({service: fixture().service + '\nawait tx.memberPayment.create({})'})));
assert.throws(() => assertPaidEpinHeld(fixture({controller: fixture().controller + "\n@Post('epin/redeem')"})));
assert.throws(() => assertPaidEpinHeld(fixture({memberFiles: ['epin.controller.ts']})));
assert.doesNotThrow(() => assertPaidEpinHeld(fixture({memberFiles:['member.service.ts','genealogy.service.ts']})));
assert.throws(() => assertPaidEpinHeld(fixture({memberFiles:['member-genealogy.service.ts']})));
assert.throws(() => assertPaidEpinHeld(fixture({memberFiles:['paid-genealogy.service.ts']})));
assert.throws(() => assertPaidEpinHeld(fixture({migrations: [...expectedMigrations, '0009_paid_epin']})));

assertPaidEpinHeld({
  schema: read('backend/prisma/schema.prisma'),
  service: read('backend/src/members/member.service.ts'),
  controller: read('backend/src/members/member.controller.ts'),
  migrations: readdirSync(new URL('backend/prisma/migrations/', root), {withFileTypes: true})
    .filter(entry => entry.isDirectory()).map(entry => entry.name).sort(),
  memberFiles: readdirSync(new URL('backend/src/members/', root)).filter(name => name.endsWith('.ts')),
});
// Approved M6 wallet endpoints require authenticated member credentials, a
// guarded Admin decision path, and separate finance enablement. Keep E-PIN
// paid issuance and payment gateway routes on the existing legal HOLD.
const memberRoutes=read('backend/src/members/member.controller.ts');
const walletService=read('backend/src/members/member-wallet.service.ts');
assert.match(memberRoutes,/@UseGuards\(MemberGuard\) @Get\('wallet'\)/);
assert.match(memberRoutes,/@UseGuards\(MemberGuard\) @Post\('wallet\/payouts'\)/);
assert.match(memberRoutes,/@Post\('payouts\/:id\/decide'\) @StaffRoles\(StaffRole.ADMIN\)/);
assert.match(walletService,/MEMBER_WALLET_ENABLED/);
assert.match(walletService,/MEMBER_COMPENSATION_APPROVED/);
assert.match(walletService,/FOR UPDATE/);
assert.doesNotMatch(walletService,/paymentGateway|stripe|razorpay|checkoutSession/i,
 'Offline wallet payout must not initiate a live transfer');
// Only the exact nonfinancial direct-invitation viewer may be named
// genealogy.service.ts; it must be query-only, bounded and UAT-gated.
const directGenealogy=read('backend/src/members/genealogy.service.ts');
assert.match(directGenealogy,/assertUatPinEnvironment/);
assert.match(directGenealogy,/GENEALOGY_MAX_LEVEL=5/);
assert.match(directGenealogy,/GENEALOGY_MAX_NODES=150/);
assert.match(directGenealogy,/this\.db\.memberInvitation\.findMany/);
assert.doesNotMatch(directGenealogy,
/\b(?:create|createMany|update|updateMany|upsert|delete|deleteMany|executeRaw|queryRaw)\s*\(/,
 'Genealogy viewer cannot mutate authoritative member/finance records');
assert.doesNotMatch(directGenealogy,
/\b(?:CommissionLedger|PayoutLedger|MemberWallet|MatrixPlacement|ReferralReward|RebirthId)\b/i,
 'Direct-referral genealogy cannot implement financial matrix operations');
// The MEGA-aligned candidate factory is explicitly nonfinancial and unexposed.
const candidateCore=read('backend/src/security/epin-batch.ts');
assert.match(candidateCore,/export function prepareEpinBatch/);
assert.doesNotMatch(candidateCore,/^import .*@(?:prisma|nestjs)\//m,
 'Pre-issuance batch core must not access database/controllers');
assert.doesNotMatch(candidateCore,/@(?:Controller|Post|Get|Patch)\(/,
 'Unapproved issuance HTTP endpoints must remain absent');
assert.doesNotMatch(read('backend/src/app.module.ts'),/\bEpin(?:Controller|Module|Service)\b/,
 'No paid E-PIN provider mounted while SRS financial HOLD applies');
const staffPreview=read('backend/src/staff/staff-batch.controller.ts');
assert.match(staffPreview,/@StaffRoles\(StaffRole.ADMIN\)/,
 'Only authorized staff may validate unissued E-PIN policy');
assert.match(staffPreview,/@Post\('validate'\)/);
assert.match(staffPreview,/issuanceStatus:'HOLD'/);
assert.match(staffPreview,/canIssue:false,generated:0/);
assert.doesNotMatch(staffPreview,/prepareEpinBatch\s*\(/,
 'The HTTP layer must never generate unissued bearer material');
// Only non-issuing validation and its read-only operator history are allowed.
const staffRoutes=[...staffPreview.matchAll(/@(Get|Post|Patch|Put|Delete)\('([^']+)'\)/g)]
 .map(([,method,path])=>method.toUpperCase()+' '+path);
assert.deepEqual(staffRoutes,['GET history','POST validate'],
 'Unapproved financial E-PIN operation added to staff-only controller');
assert.match(staffPreview,/actorId:req\.staff!\.id,action:'EPIN_BATCH_POLICY_VALIDATED'/,
 'History must be restricted to the authenticated operator and validation action');
assert.match(staffPreview,/take:25/,
 'Personal validation history must be bounded');
// Redemption preconditions are read-only and cannot become an issuance API.
const redemptionPolicy=read('backend/src/security/epin-redemption-preconditions.ts');
assert.match(redemptionPolicy,/assertEpinRedemptionPreconditions/);
assert.doesNotMatch(redemptionPolicy,/^import .*@(?:prisma|nestjs)\//m,
 'Pure E-PIN policy must never mutate financial/member state');
assert.doesNotMatch(redemptionPolicy,/@(?:Controller|Post|Get|Patch)\(/,
 'Financial HOLD forbids redeem and issue routes');
assert.doesNotMatch(read('backend/src/app.module.ts'),/\bEpinRedemption(?:Controller|Module|Service)\b/,
 'Unapproved redemption module mounted');
// E-PIN matching is pure, cannot be repurposed as live issuance/redeem.
const bearerVerifier=read('backend/src/security/epin-bearer-verification.ts');
assert.match(bearerVerifier,/export function matchesEpinBearer/);
assert.match(bearerVerifier,/timingSafeEqual/);
assert.match(bearerVerifier,/export function matchesRegistrationPinEvidence/,
 'Registration-only evidence must compose existing pure policies');
assert.match(bearerVerifier,/assertEpinRedemptionPreconditions/,
 'Registration evidence must not bypass metadata and replay checks');
assert.doesNotMatch(bearerVerifier,/\b(?:\$transaction|findUnique|findMany|updateMany|upsert|createMany)\s*\(/,
 'Registration evidence must never access or mutate authoritative MySQL');

assert.doesNotMatch(bearerVerifier,/^import .*@(?:prisma|nestjs)\//m,
 'E-PIN bearer verifier cannot access database/controller frameworks');
assert.doesNotMatch(bearerVerifier,/@(?:Controller|Post|Get|Patch|Put|Delete)\(/,
 'Paid E-PIN issue/redeem HTTP paths remain on signed HOLD');
assert.doesNotMatch(read('backend/src/app.module.ts'),/\bEpinBearer(?:Controller|Module|Service)\b/,
 'No financial bearer provider may be mounted');
// Business correction (3 Nov 2026): one payment at registration only.
assert.match(candidateCore,/export type EpinKind='ACTIVATION';/,
 'A second E-PIN/payment type must not re-enter Nisvartha');
assert.match(candidateCore,/if\(pinType!=='ACTIVATION'\)/,
 'Unapproved MEGA installment request must fail closed');
assert.match(read('backend/src/staff/staff-batch.dto.ts'),/@IsIn\(\['ACTIVATION'\]\)/,
 'Staff validation DTO must accept only the registration E-PIN type');
assert.doesNotMatch(read('frontend/components/admin-epin-batch-validation.tsx'),
 /<option value="INSTALLMENT">/,
 'Registration preview must not expose an installment choice');
assert.doesNotMatch(redemptionPolicy,/\binstallment(?:AmountSnapshot|Count)\b/,
 'One-time registration snapshot cannot require installment fields');
console.log('Paid E-PIN HOLD scope gate and negative regression fixtures: PASS');
