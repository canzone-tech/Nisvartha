# NISVARTHA — owner-confirmed milestones, member identity and position lifecycle

**Record:** NIS-MILESTONE-2026-11-09  
**Decision date:** 9 November 2026  
**Status:** Owner-confirmed **business requirements and UX acceptance contract**; not an implementation or release sign-off.  
**Source baseline:** `feat/versioned-matrix-sandbox-policy-2026-11-05` at `a226983de03cbeea02a601fb0620d9bf6b71e451`.  
**Precedence:** This records owner refinements to `OWNER-CONFIRMED-BUSINESS-2026-11-05.md`; it does not silently amend SRS v1.0's legal, privacy, financial-activation or external approval gates.

> **Owner correction (9 November 2026):** The [simple client core flow](CLIENT-SIMPLE-CORE-FLOW-2026-11-09.md) supersedes any M3 step requiring a second Admin approval after redemption of a valid Admin-issued E-PIN. New valid PIN registrations must activate and place atomically, and one Admin-created root is the initial inviter. Deliver root → E-PIN → active member → referral/matrix/rebirth → wallet/payout without extra review screens. The pre-existing 8-character code and closed-parent requirements remain. Financial/legal activation safeguards remain separate from the member-facing workflow.

## Delivery discipline (all milestones)

Deliver one milestone at a time: establish scope and baseline, reuse existing code, test the exact built runtime, obtain stakeholder acceptance, and freeze **that approved contract + its regression gates** before starting the next milestone. "Frozen" does **not** prohibit a verified security or correctness fix: such fixes require a reviewed, narrowly scoped PR and re-running all affected previous milestone gates.

- **M0 — Baseline and contract audit:** record approved integration HEAD, source/SRS/DB/migration inventory, actual CI evidence, differences between implementation and signed requirements, and open compliance/design decisions. **Gate:** reproducible checks, no accidental change to `main`, documented blockers.
- **M1 — Public website:** client-approved content, navigation, responsive design, public enquiry/volunteer forms, SEO, consent and accessibility. **Gate:** real-browser desktop/mobile route and form tests, approved visual UAT.
- **M2 — Admin and content operations:** login/RBAC, CMS, enquiry handling, media review, audit history. **Gate:** unauthorized access denied, real MySQL state transitions, browser workflows, backup/restore.
- **M3 — Root bootstrap, PIN-based active registration and referral identity:** one Admin-created root, single-use Admin-issued E-PIN, immediate ACTIVE registration with no second Admin approval, 8-character code, email-or-code/password login, member dashboard. **Gate:** DB/HTTP/UI validation, idempotency, collision/concurrency, access-control and browser UAT.
- **M4 — Referral attribution and matrix placement:** separate unlimited direct-inviter lineage from deterministic breadth-first 1:3 / five-level positions. **Gate:** 3/9/27/81/243 slot counts, placement order, uniqueness, rollback and concurrency.
- **M5 — Rebirth and closed-parent lifecycle:** independent original/rebirth cycles, recursive 1+3 re-entries and position-level financial closure. **Gate:** multi-generation exact-count, replay, concurrency, no post-closure accrual and historical read-only UAT.
- **M6 — Earnings and external settlement records:** eligible source evidence, approved earnings and controlled offline settlement/reconciliation. **Gate:** independent source-of-funds/legal approval **before activation**, authoritative ledgers, idempotent records, reversals and reconciliation; no assumed payout permission.
- **M7 — Integrated release candidate:** compiled frontend + API startup, health/readiness, environment/build parity, clean dependency install, full root `npm run verify`, API/Web/Local Parity/Compiled CI on the exact release SHA, human UAT, backup/restore, deployment approval. No "complete" declaration from compilation alone.

A green suite on the integration baseline is evidence for that exact baseline, not a passing result for future M3/M5 modifications. Do not run `npm run verify` against production data: it is an isolated disposable-MySQL verification command.

## M3 — Member referral ID and login: **owner-approved**

1. Issue exactly **8 uppercase alphanumeric characters** in `A-Z0-9`, unique per member, using a cryptographically secure generator plus a database unique constraint and bounded collision retry. This is an 8-**character** identifier, not an 8-digit numeric PIN.
2. A member can log in with either **registered email + password** or **referral code + the same password**. Referral code alone cannot authenticate; no passwordless login is authorized.
3. Use the same code for inviting other members, with independent single-use Admin-issued E-PIN and minimum required applicant consent; a valid PIN activates immediately without another Admin membership approval. Inviter referral lineage is not the forced-placement parent relationship.
4. Keep the code stable for the member's account. Existing 22-character issued codes/invitation URLs, if present, must be migrated or compatibly supported by a reviewed append-only plan; do not rewrite active accounts or orphan invitations.
5. Member dashboard prominently displays the code with accessible **Copy** and **Share** controls and clear non-misleading feedback. Use professional visual emphasis rather than distracting perpetual blinking; respect reduced-motion.
6. Authentication must preserve generic error messages, lockout, rate limiting, session expiry/revocation, suspended-account denial, no account enumeration, and secret-free logs.

**M3 regression gate:** generate many unique 8-character codes; force collision handling; test case normalization and old-code migration; test email and code login with correct/incorrect password, lockout, denied statuses, member session, invitation attribution, copy/share, mobile/keyboard/screen-reader interaction and no sensitive details in redirects/logs.

**Current source gap:** `member.service.ts` still creates PENDING/SUBMITTED records requiring Admin review, generates 22-character base64url codes and looks up login by email; `member.dto.ts`, `frontend/lib/referral-share.ts` and member forms expect 22-character invite codes; Prisma `MemberAccount.referralCode` stores up to 22 characters. This milestone is **not implemented/frozen** merely because this document exists.

## M5 — Recursive rebirth and parent closure: **owner-approved**

1. Each `ORIGINAL` or `REBIRTH` matrix **position** has an independent five-level 1:3 completion cycle; positions belong to the same underlying member account.
2. **Level 4 completion:** generate exactly **one** rebirth position. **Level 5 completion:** generate exactly **three more** for that same source position. Each eligible rebirth position follows the identical rule recursively, with **no owner-approved maximum generation count**.
3. Every new position is placed at the next available global breadth-first slot, deterministically and without granting a new human login or requiring another registration E-PIN/fee.
4. **Immediately after all four children (1 + 3) have been generated**, the **source/parent position** becomes `COMPLETED_READ_ONLY`. Its historical tree, earnings and events stay visible after member authentication; it cannot create additional rebirths, initiate fresh position-level financial activity, or accrue further position-level earnings.
5. **Do not close the owning member account:** the member can continue logging in, viewing all positions, and using their single 8-character referral code to invite new eligible members.
6. **Direct referral eligibility continues at member-account level after a parent position completes**, subject to the separately approved lawful commercial eligibility rules. A new qualifying invited member must never reopen or post fresh earnings to the completed matrix position. Member-level referral attribution and matrix-position-level accrual are separate.
7. New rebirth positions remain individually active until **their** full completion and closure. Closing one parent must not pause or close a different original/rebirth position owned by the member.
8. Complete-position closure, credit eligibility and all child allocations must be atomic, idempotent, audited and concurrency-safe. Persist deterministic event/entry keys; retries cannot create more than four children for a completed source.
9. **Existing obligations are not forfeited:** previously recorded earned-but-unsettled items retain their immutable status and evidence. Any authorized back-office reconciliation/settlement must operate on those independent earning records without reopening the parent position or introducing new accruals. This is a data-integrity rule, **not** permission to issue financial payouts.
10. Engineering cascade limits may fail closed or defer/retry work safely with recovery evidence; they cannot silently drop eligible entries or be represented as a business rebirth-generation cap.

**M5 regression gate:** each L4/L5 trigger exactly once; original and rebirth-of-rebirth cycles; one parent closure after four entries; unchanged member login and referral after closure; closed parent denies new position financial accruals while descendants progress; concurrency, retry/restart, total-order allocation, immutable audit, compensation flags, bounded work recovery and rollback tests.

**Current source gap:** `matrix-placement.service.ts` creates recursive entries using unique keys and marks `completedAt` at L5, but **does not yet prove** an explicit enforced read-only financial lifecycle contract. `MAX_REBIRTHS_PER_ACTIVATION=128` is an engineering protection, not a business cap. No code or migration change is authorized merely by this written contract.

## Client-facing forms and visual acceptance: **owner-approved**

The deliverable is a **clean, standard professional software product**, not a developer prototype. Reuse the existing client v1.1 design system and shared field/button/alert patterns; avoid isolated page styles or duplicated validation rules.

- Consistent brand colors/typography and spacing, coherent label/input sizing, aligned actions, responsive two-column layouts only when they improve usability, clear hierarchy, and no horizontal overflow on phones.
- Forms should expose **only actionable, client-relevant fields**; use meaningful labels, inline errors by field, sensible input types and autofill, one obvious primary action, proper loading/submission/empty/success states, keyboard/focus behavior, and duplicate-submit protection.
- No test fixtures, sandbox/version/feature-flag labels, developer stack terminology, internal approval-state jargon, technical policy switches, speculative scheme claims, or decorative "terms" sections that do not help the user complete a task.
- **Keep mandatory notices/consents:** when personal information is collected, the required purpose-specific privacy notice and applicable membership terms/consent must remain available in concise human wording with links to approved documents. Do **not** silently delete legal prerequisites, verification steps, material programme disclosures or required opt-ins to make forms look simpler.
- Keep client copy distinct from admin-only operational details. Never expose settlement evidence, private member data or sensitive internal compliance mechanics on public pages.
- No distracting flashing effects; use restrained emphasis, visible focus states, accessible contrast, and reduced-motion support.

**Visual acceptance gate:** inspect actual rendered desktop/mobile login, registration, Admin member form, enquiry and dashboard states; verify approved copy, field density, keyboard navigation, screen-reader labels, validation/error/success feedback, no test-era or unexplained policy copy; capture reproducible screenshots in CI/UAT and obtain owner sign-off before freezing a milestone.

## M0 discrepancy and non-negotiable release boundary

The inspected `/auto-pool-plan` runtime returns an informational **200** with controlled enrolment copy, while `docs/SRS-TRACEABILITY.md` still describes a **404** for FR-013. Do not silently "fix" this by weakening either production behavior or the SRS: reconcile the route/indexing contract and approved content under M0 with stakeholder/legal reviewers.

This document confirms business intent for design and gated tests only. It is **not** an authorization to collect fees, guarantee earnings, activate a recruitment-driven compensation scheme, produce payouts or change a production financial state. SRS v1.0 requires a separately signed and legally reviewed scope for those financial functions. An existing implementation or green CI result is not a substitute for independent approval.

**Git boundary:** create reviewed feature PRs into the current integration line, preserve existing applied migrations and confidential data, do not rewrite `main`, and only freeze a milestone after exact-head verification and the appropriate independent approval.
