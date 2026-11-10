import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Explicit App Router pages; backend-authenticated and server-RBAC guarded.
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const routes=[
 ['enquiries','enquiries'],
 ['members','members'],['staff','staff'],['audit','audit'],
 ['epin','epin'],['recovery','recovery'],['matrix','matrix'],['donations','donations']
];
const shell=read('frontend/components/admin-workspace.tsx');
const root=read('frontend/app/admin/page.tsx');
assert.match(root,/legacyAdminHref/,'Legacy admin links need safe redirects');
assert.match(root,/<AdminWorkspace view="overview"\s*\/>/);
assert.match(shell,/staffFetch\('staff\/me'\)/,'Workspace must authenticate with backend');
assert.match(shell,/if\(!permitted\.has\(view\)\)redirect\('\/admin'\)/,
 'Forbidden deep links must be denied server-side');
assert.match(shell,/aria-current=\{view===item\.view\?'page'/,
 'Active navigation must be accessible');
assert.doesNotMatch(shell,/\/admin\?view=/,'No single query-param router');
assert.doesNotMatch(shell,/content:'\/admin\/content'|media:'\/admin\/gallery'/,'Retired editor routes must not appear in navigation');
assert.doesNotMatch(shell,/AdminEpinBatchValidationPanel/,'Duplicate E-PIN policy form must be removed from Admin');
assert.match(shell,/AdminRegistrationPins/,'One Admin E-PIN inventory/creation form must be reachable');
assert.match(shell,/DONATION_ACCOUNTING_ENABLED/,'NGO donation register must follow compiled release policy');
assert.match(shell,/DonationRegister/,'Admin donation register must remain part of workspace');
assert.match(shell,/REGISTRATION_ACCESS_PIN_ENABLED/,'No-fee PIN generation must be explicitly gated');
const staffPanel=read('frontend/components/admin-staff-panel.tsx');
assert.doesNotMatch(staffPanel,/Create administrator|new-password|staff\/accounts','POST'/,
 'Single-ADMIN website must not offer a second ADMIN');
assert.match(staffPanel,/Disable legacy administrator/);
assert.match(shell,/currentAdminId=\{user\.id\}/);
const staffController=read('backend/src/staff/staff.controller.ts');
assert.doesNotMatch(staffController,/@Post\('accounts'\)/,'Single-ADMIN API must not create more staff');
const payoutPanel=read('frontend/components/admin-member-payouts.tsx');
assert.match(payoutPanel,/payouts\/page/,'Admin payouts must query server-paginated history');
assert.match(payoutPanel,/Previous page/,'Admin payout table must support reverse pagination');
assert.match(payoutPanel,/payoutStatus|Filter by status|Filter records/,
 'Admin payout table must expose a status filter');
assert.match(payoutPanel,/table-scroll/,'Payouts must use responsive tabular display');
assert.match(payoutPanel,/payment-details/,'Admin payout must reveal protected payee snapshot on demand');
const memberPayouts=read('frontend/components/member-wallet.tsx');
assert.match(memberPayouts,/payouts-page/,'Member history must be server-side paginated');
assert.match(memberPayouts,/table-scroll/,'Member payout history must use responsive table');
const profile=read('frontend/components/member-payout-profile.tsx');
assert.match(profile,/defaultMethod/,'Member needs saved default Bank/UPI method');
const pinPanel=read('frontend/components/admin-registration-pins.tsx');
assert.match(pinPanel,/pendingRequestKey\.current= requestKey|pendingRequestKey\.current=requestKey/,
 'Network retries must retain the same PIN batch request key');
assert.match(pinPanel,/pendingRequestKey\.current=null/,
 'Confirmed batch creation must retire its request key');
assert.match(pinPanel,/pin\.code\?<code className="admin-pin-full-code"/,'Admin inventory must display full encrypted PINs');
assert.match(pinPanel,/\(legacy\)/,'Unrecoverable legacy hash-only PINs remain visibly masked');
assert.match(shell,/AdminMatrixPreview/,'Matrix sandbox must be mounted only for authorized Admin');
assert.match(shell,/AdminMatrixExplorer/,'Real Admin matrix workspace must use existing member matrix API');
assert.match(shell,/process\.env\.MATRIX_PLACEMENT_ENABLED==='true'\|\|process\.env\.NISVARTHA_UAT_PLAN==='synthetic'/,
 'Production member matrix route must not depend on disposable synthetic mode');
const matrixExplorer=read('frontend/components/admin-matrix-explorer.tsx');
assert.match(matrixExplorer,/AdminMemberMatrix/,'Admin matrix must reuse existing authoritative matrix view');
assert.match(matrixExplorer,/cms\/membership\/applications\/page/,'Active member list must reuse protected paged API');
assert.match(matrixExplorer,/status:'APPROVED'/,'Matrix explorer must list approved member records');
assert.doesNotMatch(matrixExplorer,/\/api\/v1\/members\//,
 'Matrix explorer must not bypass staff session/BFF with a direct member endpoint');
assert.match(shell,/MATRIX_PLACEMENT_ENABLED==='true'/,
 'Persistent 1:3 member matrix must be explicitly gated');
assert.match(read('frontend/app/admin/matrix/page.tsx'),/AdminWorkspace view="matrix"/,
 'Admin matrix route must be a protected server-rendered workspace');
const memberMatrix=read('frontend/components/member-matrix-tree.tsx');
assert.match(memberMatrix,/1:3 Auto Pool Matrix/);
assert.match(memberMatrix,/\[1,2,3\]\.map\(slot/,'Persistent matrix must keep exactly three slots');
assert.doesNotMatch(memberMatrix,/wallet|withdrawal amount|commission balance/i,
 'Member matrix view must not expose a financial balance');
const previewDiagram=read('frontend/components/admin-matrix-preview.tsx');
assert.match(previewDiagram,/ThreeSlotMatrixPreview/,'Admin matrix must expose a three-slot preview');
assert.match(previewDiagram,/\[1,2,3\]\.map\(slot/,'All three positions must render even when empty');
assert.match(previewDiagram,/matrix-visual-empty/,'Unused positions must be visibly empty');
assert.match(previewDiagram,/depth>=3/,'Read-only diagram must stay bounded to three levels');
assert.match(previewDiagram,/operational placement, rebirth, payment or commission record/,
 'Do not confuse preview with authoritative financial placement');

assert.match(shell,/AdminMemberRecoveryPanel/,'Keep gated member recovery');
const genealogyTree=read('frontend/components/genealogy-tree.tsx');
assert.match(genealogyTree,/MATRIX_WIDTH=3/,
 'Tree must show exactly 3 visual slots per parent');
assert.match(genealogyTree,/Array\.from\(\{length:MATRIX_WIDTH\}/,
 'Tree must render all three slots even if not occupied');
assert.match(genealogyTree,/genealogy-empty-slot/,
 'Empty 1:3 positions must be visible');
assert.match(genealogyTree,/genealogy-overflow/,
 'More than three real direct invites must never be hidden');
assert.match(genealogyTree,/<details className="genealogy-slot-details"/,
 'Genealogy branches must remain keyboard-operable');
assert.match(genealogyTree,/levelCounts\(tree\.root,tree\.maximumLevel\)/,
 'Bounded genealogy must show per-level counts from backend data');
assert.doesNotMatch(genealogyTree,/commissionAmount|walletBalance|payoutAmount/,
 'Genealogy must not expose financial projections');
const service=read('backend/src/staff/uat-scenario.service.ts');
const launcher=read('scripts/local-uat.sh');
assert.match(service,/NISVARTHA_UAT_FINANCE/);
assert.match(service,/isDisposableUatDatabase\(\)/);
assert.match(service,/Prisma\.TransactionIsolationLevel\.Serializable/);
assert.match(service,/kind_sourceMemberId/);
assert.match(service,/take:historyPageSize\+1/,'History truncation must use a 201st-row sentinel');
assert.match(service,/directTotals\._sum\.amountPaise/,'Synthetic reference totals cannot depend on a paginated display');
assert.match(service,/directTotals\._count\._all/,'Synthetic reference counts cannot depend on a paginated display');
assert.match(service,/Prisma\.TransactionIsolationLevel\.RepeatableRead/,
 'Scenario event summaries need one consistent database snapshot');

assert.match(launcher,/NISVARTHA_UAT_FINANCE=synthetic/);
const memberShell=read('frontend/components/member-dashboard.tsx');
const memberPage=read('frontend/app/member/page.tsx');
const sharedCss=read('frontend/app/globals.css');
assert.match(memberPage,/foundation-admin foundation-member/,
 'Member page must use the same internal layout container as Admin');
assert.match(memberShell,/foundation-admin-header/,
 'Member account header must match Admin structure');
assert.match(memberShell,/foundation-admin-layout/,
 'Member dashboard needs an Admin-style sidebar/main layout');
assert.match(memberShell,/foundation-admin-sidebar/,
 'Member sidebar missing');
assert.match(memberShell,/aria-label="Member workspace navigation"/,
 'Member navigation needs an accessible label');
assert.match(memberShell,/data-member-view=\{view\}/,
 'Member sections must follow selected navigation');
for(const section of ['overview','application','profile','security'])
 assert.match(memberShell,new RegExp("view==='"+section+"'"),
  'Member workspace section missing: '+section);
const referral=read('frontend/components/member-referral-share.tsx');
const registration=read('frontend/app/member/register/page.tsx');
const memberForm=read('frontend/components/member-auth-form.tsx');
assert.match(memberShell,/MemberReferralShare/,'Member dashboard must show share controls');
assert.match(referral,/https:\/\/wa\.me|whatsappReferralShareUrl/,
 'WhatsApp handoff missing from invitation UI');
assert.match(referral,/navigator\.clipboard\.writeText\(url\)/,
 'Invitation copy action must use exact generated URL');
assert.match(registration,/NISVARTHA_UAT_PIN_REGISTRATION==='synthetic'/);
assert.match(registration,/REGISTRATION_ACCESS_PIN_ENABLED==='true'/,
 'Registration access PIN inviter URL must be gated');
assert.match(registration,/INVITE_CODE_PATTERN\.test\(invite\)/,
 'Invite code in URL must be validated before prefilling registration');
assert.match(memberForm,/name="inviteCode"/,
 'Registration E-PIN flow must accept a validated inviter code');
assert.match(memberForm,/autoActivate\?'Referral code'/,
 'Immediate PIN activation must label the referral field without approval jargon');
assert.match(memberForm,/defaultValue=\{initialInviteCode\}/,
 'Member registration must prefill validated inviter code');
assert.doesNotMatch(memberShell,/createCommission|creditReferral|createPayout|memberWallet/,
 'Never activate referral earnings in Member UI');
assert.match(sharedCss,/foundation-member-nav-button/,
 'Member sidebar must be independently styled, reusing Admin tokens');
assert.match(sharedCss,/@media\(max-width:480px\)[\s\S]*foundation-member-stats/,
 'Member overview must remain responsive');

for(const [segment,view] of routes){
 const page=read('frontend/app/admin/'+segment+'/page.tsx');
 assert.ok(page.includes('<AdminWorkspace view="'+view+'"/>'),
  'Missing route module '+segment);
 assert.match(page,/robots:\{index:false,follow:false\}/,
  'Staff deep link must not be indexed: '+segment);
}
for(const path of ['content','gallery'])assert.match(read('frontend/app/admin/'+path+'/page.tsx'),/redirect\('\/admin'\)/,'Retired CMS editor route must redirect: '+path);
console.log('Nisvartha member-first Admin routes, no editor navigation and noindex: PASS');
