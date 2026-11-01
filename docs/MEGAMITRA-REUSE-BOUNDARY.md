# Nisvartha — MegaMitra source reuse boundary

Source reference (read-only): `canzone-tech/megamitra`, branch `dev/local-foundation`, inspected 31 Oct 2026. This is an engineering inventory, **not** authorization to enable a financial programme.

## Verified source reuse

| Component in MegaMitra | Actual dependencies/behaviour | Nisvartha decision |
|---|---|---|
| `backend/src/auth/password.service.ts` | Argon2id with memoryCost=65536, timeCost=3 | Reuse security pattern in staff authentication |
| `auth.service.ts`, `jwt-auth.guard.ts` | Revocable sessions, role/permission assignment, lockouts, strict bearer auth; coupled to MegaMitra configs | Adapt session concepts with independent Nisvartha staff sessions |
| `backend/src/rbac/*` | NestJS role & permission decorators/guards | Reuse independent server-side roles for Editor, Approver, Admin, Auditor |
| `audit.service.ts` | Database audit records keyed to actor/action/entity | Reuse transactionally audited mutations in dedicated Nisvartha tables |
| `admin/lib/server-session.ts` | HttpOnly SameSite cookies, server-side refresh and backend proxy | Reuse BFF/cookie architecture, with Nisvartha-only origin and session |
| `backend/src/auth/member-registration.service.ts` | Paid activation E-PIN, session/season programmes, sponsor, monthly instalments, genealogy and Lucky Draw token dependencies | **Do not copy wholesale**; not a generic member-registration module |
| `backend/src/genealogy/genealogy.service.ts` | `BinaryPlacementSide=LEFT/RIGHT`; `SLOT_ORDER=['A','B','C','D']`; binary placement/ancestry SQL | **Do not change 4 to 3** in place; side, ancestry, commission and concurrency contracts differ |

## Registration identity decision (1 November 2026)

Source inspected in MegaMitra `dev/local-foundation`: `MemberRegistrationService.registrationConfig()` exposes `epinRequired: true` while `emailRequired` remains separately configurable. `MemberRegistrationService.register()` enforces an activation E-PIN; it does **not** make automated email verification a condition of E-PIN validation. Email presence and automated email verification are distinct controls.

Nisvartha owner decision: **do not require automated email verification for E-PIN-based onboarding**. Preserve account password/session security, validated one-time E-PIN eligibility, audit, user/role authorization and a controlled identity recovery path. The Nisvartha nonfinancial application currently has **no E-PIN consumption**, so its APPROVED status must not be represented as paid activation. MegaMitra's payment records, seasonal installments, binary placement and reward automation cannot be transplanted unchanged into Nisvartha's legally unapproved 1:3 programme.

## Nisvartha flyer reference — financially unapproved

- Described matrix is fixed **1:3**, five levels with slots `3/9/27/81/243` (363 in total), **not binary LEFT/RIGHT**.
- Flyer figures, rebirth IDs and earnings are **unverified stakeholder claims**. Their arithmetic in `docs/flyer-reference.json` is reference-only; not valid payout funding rules.
- The SRS v1.0 explicitly excludes live E-PIN/member activation, placement, wallet, payout, commissions, rebirth and payment collection without **new signed scope and independent legal/financial review** (FR-029–034; sections 2.4, 6.5 and R-01/R-02).
- Before designing a later legally permitted member module: define identity lifecycle, sponsor vs placement semantics, 1:3 slot-occupation algorithm, depth limits, cycle prevention, unique constraints, locks/concurrency, cancellation and re-entry, reversals, idempotency, audit, reconciliation, payouts source, tax/refunds, and UAT fixtures. These cannot be inferred safely from the flyer.
- **No MegaMitra data, migrations, business rules, deployment or proprietary assets are imported into Nisvartha**; MegaMitra remains untouched.

## Current approved delivery sequence

1. Phase 1 public website (isolated base branch).
2. Phase 2 **staff-only CMS**: authenticated staff identity and RBAC, draft/review/publish, audit and approved content public read path. Features still being verified against SRS FR-019–028.
3. Member portal and financial modules: separate requirements/legal approval. Even after approval, never silently migrate MegaMitra binary data to a Nisvartha 1:3 tree.

All actual code changes take place on `dev/phase2-cms-admin`, branched from `dev/phase1-public-website`. Production and default branch remain unchanged.
