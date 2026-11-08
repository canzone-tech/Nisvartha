import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const policy=read('README.md');
const schema=read('backend/prisma/schema.prisma');
const content=read('frontend/lib/site.ts');
const pages=['about','activities','go-green','projects','volunteer','donate','membership','how-it-works','gallery','news-events','contact','privacy-policy','terms','accessibility','login','register'];
assert.match(policy,/fixed 1:3 matrix/);
assert.match(policy,/not.*MegaMitra's binary/i);
for(const name of pages)assert.ok(content.includes("slug: '"+name+"'"),'Missing SRS route '+name);
assert.match(schema,/model Enquiry/);
assert.doesNotMatch(schema,/\\b(?:model|enum)\\s+(?:Binary|Pair|Genealogy|Commission|Wallet|Referral|LuckyDraw)\\w*/i,'No financial/matrix domain models allowed');
assert.doesNotMatch(schema,/^\\s*(?:walletBalance|referralId|matrixParentId|payoutAmount|commissionAmount)\\s/m,'No financial fields allowed');
const migrations=readdirSync(new URL('backend/prisma/migrations/',root),{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name);
assert.deepEqual(migrations,['0001_public_enquiries','0002_staff_cms','0003_enquiry_cases','0004_event_details','0005_local_media_gallery','0006_media_evidence_refs','0007_member_accounts','0008_member_password_recovery','0009_staff_super_admin_role','0010_staff_assisted_member_registration','0011_synthetic_pin_invitation','0012_enquiry_phone','0013_sandbox_policy_revisions','0014_admin_only_accounts','0015_nonfinancial_registration_pins','0016_encrypted_admin_pin_visibility','0017_local_uat_scenario_events','0018_owner_confirmed_uat_source','0019_offline_donation_register','0020_donation_refund_reconciliation','0021_nonfinancial_matrix_positions','0022_offline_sale_earnings_rebirth'],'Unexpected migration outside scoped SRS P0/P1 work');
assert.match(read('frontend/app/robots.ts'),/disallow:'\/'/);
assert.match(read('backend/src/enquiries/enquiry.service.ts'),/PRIVACY_NOTICE_APPROVED/);
assert.match(read('backend/scripts/enquiries.mjs'),/NISVARTHA_OPERATOR_DATABASE_URL/);
console.log('Nisvartha phase/scope regression gate: PASS');

await import('./check-flyer.mjs');
await import('./test-admin-routes.mjs');
await import('./test-epin-expiry-picker.mjs');
await import('./test-staff-assisted-registration.mjs');
await import('./test-client-bundle.mjs');
await import('./test-client-unified-design.mjs');
await import('./test-client-link-adapter.mjs');
await import('./test-client-public-source.mjs');
await import('./test-client-responsive-adapter.mjs');

assert.match(read('backend/prisma/schema.prisma'),/model CmsRevision/);
assert.match(read('backend/prisma/schema.prisma'),/model StaffSession/);
assert.match(read('backend/prisma/schema.prisma'),/model CmsAudit/);

assert.match(schema,/model CmsMedia/);
assert.match(read('backend/src/media/media.service.ts'),/MEDIA_STORAGE_ROOT/);

assert.match(schema,/rightsEvidenceRef String[?]/);
assert.match(schema,/consentEvidenceRef String[?]/);

assert.match(schema,/model MemberAccount/);
assert.match(schema,/model MembershipApplication/);
assert.match(read('backend/src/members/member.service.ts'),/MEMBER_PORTAL_ENABLED/);

assert.match(schema,/model MemberPasswordRecovery/);
assert.match(read('backend/src/members/recovery.service.ts'),/MEMBER_RECOVERY_ENABLED/);

assert.match(schema,/model MatrixPosition/,'Persistent nonfinancial 1:3 placement model missing');
assert.match(read('backend/src/members/matrix-placement.service.ts'),/MATRIX_PLACEMENT_ENABLED/);
assert.match(read('backend/src/members/member-compensation.service.ts'),/OFFLINE_SALE_AMOUNT_PAISE=1_500_000/);
assert.match(read('backend/src/members/member-compensation.service.ts'),/DIRECT_REFERRAL_AMOUNT_PAISE=100_000/);
assert.match(read('backend/src/members/matrix-placement.service.ts'),/REBIRTH:/);

// Paid joining is stakeholder intent, but financial implementation remains under signed SRS/legal HOLD.
await import('./check-paid-epin-hold.mjs');
