# Matrix and rebirth policy configuration — sandbox proposal

## Authority and scope
The user approved continuing design and asked for 1:3 forced-placement, rebirth configuration and real referral commissions. The uploaded SRS v1.0 still marks actual matrix, rebirth, payout and financial transactions as separate P2 scope that requires a new detailed contract and qualified legal review. The supplied client HTML explicitly labels the proposed plan "Review Pending". This feature is therefore **non-operational policy simulation**, not a payment/commission implementation.

The source record is \`docs/flyer-reference.json\`:
- Width 3, levels 5, population per level 3 / 9 / 27 / 81 / 243, total 363 positions below the root.
- Joining amount ₹15,000 and direct referral ₹1,000 from the owner flyer, **not** a validated taxable sale or compensation entitlement.
- Level payout references ₹2,500 / ₹5,000 / ₹10,000 / ₹50,000 / ₹90,000.
- Four described rebirth IDs: one at level 4 and three at level 5.

## Preview contract
The pure NestJS TypeScript core \`backend/src/security/matrix-simulation.ts\` models independent fake positions under a single root, in *deterministic breadth-first order*. It refuses more than 363 entries and only returns up to 150 displayed positions, although it computes every level's capacity.

The authenticated Admin/Super Admin page \`/admin/matrix\` exposes editable **draft** policy settings:
- Simulated registration count
- Candidate rebirth count when level 4 finishes
- Candidate rebirth count when level 5 finishes
- Cap on candidate rebirth IDs
- Show/hide candidate rebirth outcomes

The starting values follow the flyer (1, 3, cap 4), but remain explicitly **not persisted** and cannot change real member or payment states. The chosen trigger \`FULL_LEVEL_COMPLETION_UNVERIFIED\` is an **assumption for modelling only**, not an approved rebirth rule. Completing level 4 requires 120 members beneath the root; completing level 5 requires all 363. Rebirth *candidates* are reported; zero real IDs are created, zero commissions calculated and zero payments accepted.

Only on the disposable localhost UAT, with \`NISVARTHA_UAT_PLAN=synthetic\` and isolated MySQL \`nisvartha_ci\`, the staff backend exposes \`GET /api/v1/staff/matrix-preview/defaults\` and \`POST /api/v1/staff/matrix-preview/simulate\`. The existing staff cookie/BFF and Nest staff guard enforce Admin-only access. Only the staff audit record persists; the simulated positions and policy edits do not.

## Remaining contract gaps before any real engine
1. Written legal classification/permissions for actual paid membership, referrals, re-entry and compensation under current Indian law.
2. Precise distinction between sponsor invitation edges and forced placement, cross-tree spillover and placement under suspended/withdrawn accounts.
3. Rebirth trigger by position vs level, re-entry ID ownership, parent assignment, repeat limits, eligibility and lifecycle/cycle accounting.
4. Evidence of eligible **goods/services sales** rather than recruitment-only consideration, and refund/chargeback windows.
5. Funds segregation, origin of every credit, independent pricing and gross margin, TDS/GST, clawback, liability, payout thresholds and reconciliation.
6. Immutable signed effective policy version, author/approver separation, migration/rollback, transaction locks, one-time entitlement ledger and settlement history.

No production mode, activation flag, financial posting API, E-PIN payment or account-generation route exists in this PR. The existing member invitation genealogy remains unchanged.

## Acceptance
\`npm run verify\` and API CI execute \`scripts/test-matrix-sandbox.mjs\` for flyer parity, deterministic breadth-first ordering, 3/9/27/81/243 counts, 120/363 candidate thresholds, bad configurations, no side effects, 150-node output cap and safe defaults. Full local-UAT launcher additionally exercises the actual staff BFF with Admin/Approver RBAC, audited simulation and no new member records.

The approved client public page copy, as delivered, is unchanged.
