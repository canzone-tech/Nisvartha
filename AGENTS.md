# NISVARTHA — repository delivery rules

Applies to all contributors, assistants, agents and CI-driven delivery. The owner has confirmed the existing business decisions; do not reopen the 39 resolved questions or treat old draft requirements as a reason to stall. Implement against the current code, agreed rules, production contracts and verified tests. Ask only if a genuinely new business decision cannot safely be inferred.

## Non-negotiable client acceptance contract

- **Never label a financial-disabled `client-review` build as fully operational.** A clean build, 200 response, signed-in dashboard and successful technical deployment do **not** prove that paid E-PIN issuance, direct referral earnings, matrix level earnings, wallet reservations, offline settlement and payout decisions work.
- Every published artifact must name its exact release channel, commit SHA, migration head, and feature capabilities in `RELEASE_INFO.json`. The documented capability matrix and actual compiled API/web flags must match; fail closed on mismatches. Never silently flip Next.js compile-time flags at runtime.
- **Full-feature client acceptance** requires tests of paid E-PIN accounting, receipt allocation, direct referral credit, all five level amounts, 1:3 BFS placement, level-4/5 rebirth, wallet totals/reservations, audited settlements and negative/concurrent/idempotent paths. Do not fabricate bank receipts, payments or settlement evidence on the real production database. Test financial mutations on an isolated disposable database; any live financial operation requires authentic externally verified evidence.
- The owner expects an **Admin Business Rules / Commission Plan** page with versioned, auditable future-effective changes. Historical member assignments, earned amounts, settled money and bank references must not be silently recalculated when an Admin publishes a new policy. Use an authoritative MySQL record, atomic activation, immutable historical versions and auditable actor/change records. Protect every write with Admin authentication, strict validation, replay protection, concurrency safety and business invariants. A read-only reference/simulation page is **not** a substitute.
- Any member's financial entitlement must come from an independently verified, authoritative funding record; a free access PIN, registration, matrix placement, rebirth or UI flag alone is not financial evidence. Never credit the same joining fee twice or silently imply a transfer was made.
- **Do not declare software complete** until the requested business workflows and the compiled full-feature acceptance path have real database tests, lint/typecheck, builds, runtime startup, authenticated browser/API UAT and exact-head green CI.

## Deployment / Git safety

- All application development occurs on the approved review branch; never silently commit/merge to main or rewrite shared history. Verify branch/head, use fast-forward-only updates, review the final diff and exact-head CI before handoff.
- The production host receives **compiled backend/frontend runtime, locked runtime dependencies and explicitly required migration/operator assets only**. Never upload application source, run `git clone`, `npm run build`, or use the system Node.js 24 for NISVARTHA. Deploy with the dedicated Node.js 22 runtime and checksum-verified immutable artifacts.
- Use the existing `nisvartha_prod` database and append-only migrations; never reset, seed with synthetic data or replace its authoritative records. Record and verify the migration head before cutover. Preserve the prior release and rollback path.
- `npm run verify` must exercise the same source-aligned release contracts as CI; include deployment-profile assertions and durable regression tests for every gap found. Green compile alone is insufficient.
- Keep credentials out of commits, logs, CI artifacts, chat and UAT screenshots. Never substitute synthetic financial evidence on the public site.

## Immediate regression lessons (11 November 2026)

- The deployed `ae8bb72aa2e03a1a737ab52be54b4e006fad90f7` **client-review** artifact intentionally disables `MEMBER_COMPENSATION_ENABLED`, `MEMBER_COMPENSATION_APPROVED`, `PAID_PIN_ISSUANCE_ENABLED`, and `PAID_PIN_ACCOUNTING_APPROVED`. Do not relabel it full-featured.
- Auto-activated paid PINs previously recorded receipt provenance but did not automatically create the corresponding direct-referral earning; the matrix completion path also suppressed earnings whenever `MEMBER_PIN_AUTO_ACTIVATE_ENABLED=true`. Fix these contracts with financial provenance and regression tests before publishing a full-feature artifact. Do not merely change four environment variables.
- Previous Admin matrix UI was a position explorer, not a versioned rule editor. Build the admin-facing policy workflow, historical snapshots, auditability and negative tests rather than presenting the simulator as operational configuration.
