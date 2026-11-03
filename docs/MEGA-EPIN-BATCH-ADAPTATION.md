# MEGA-first E-PIN batch core — nonfinancial integration boundary

**Source reviewed:** `canzone-tech/megamitra` `dev/local-foundation`:
`backend/src/owner-portal/owner-portal.service.ts::generateEpins()`,
`backend/src/owner-portal/owner-portal.dto.ts::GenerateEpinsDto`,
`backend/src/auth/member-registration.service.ts`.
**Nisvartha baseline:** `canzone-tech/Nisvartha` `dev/phase3-epin-credential-foundation`.
**Change classification:** development-only security/validation core; no financial operation.

MEGA E-PIN issuance uses an authenticated owner-portal permission, explicit batch quantity (1–500), activation/installment types, future expiry, random secret, digest, display suffix and audit metadata. Its operational service also requires an active season, approved financial terms and persistence; its member registration interleaves E-PIN consumption, payment records, sponsor, genealogy, placements, installment catch-up and Lucky Draw tokens. Blindly copying the service would inherit those unrelated responsibilities.

## Implemented on this branch

- `backend/src/security/epin-batch.ts` prepares **unissued candidates only** with registration-only `ACTIVATION` (MEGA's `INSTALLMENT` is rejected), MEGA's 1–500 batch bounds, strictly timezone-aware future expiry, random UUID, display suffix and distinct purpose-specific hashes.
- Reuses the 256-bit cryptographic credential generator already introduced in the parent PR. This deliberately provides more entropy than the 64-bit hexadecimal display secret found in MEGA; no existing Nisvartha activation PIN compatibility contract exists to preserve.
- The sole Nisvartha purpose is `epin-activation` for one-time registration; `epin-installment` is not generated or accepted. Recovery-purpose credentials remain isolated.
- The returned plaintext is only an **ephemeral unissued candidate**. No E-PIN is valid until a future authorized, audited and atomic transactional issuance stores its digest and eligibility; there is no public API, staff issuance endpoint, frontend, order, member activation, placement or reward.
- `scripts/test-epin-batch.mjs` covers 500 unique candidates, purpose separation, expiry and invalid inputs, and verifies no authenticated/financial issuance is implied. Both API CI and root `npm run verify` execute it after the compiled build.
- Paid HOLD static gate additionally prohibits mounting E-PIN services or introducing Prisma/controller dependencies into the candidate core.

## Separate components: not silently copied

| MEGA capability | Nisvartha decision |
| --- | --- |
| Role-gated operator E-PIN issuance | Future ADMIN/SUPER_ADMIN service once signed lawful financial offer and settlement policy exist |
| MEGA ACTIVATION and INSTALLMENT candidate contract | **Adapted only ACTIVATION for Nisvartha one-time registration**; INSTALLMENT rejected, no live issuance |
| MySQL E-PIN inventory, one-use claim, assigned user | Future explicit audited transactional service and migration |
| Active session/offer, registration amount/tax and payment record | Requires actual approved one-time registration offer and authoritative settlement; no installment payments |
| Sponsor lookup and genealogy | Separate business rules, not part of E-PIN crypto |
| MEGA binary A–D/LEFT–RIGHT placement | **Never copy into Nisvartha's 1:3 level programme** |
| Lucky Draw tokens and claims | **Not included**, no Lucky Draw dependency |
| Program rewards, payout, wallet, referral, rebirth | Financial/legal HOLD; source flyer cannot authorize them |

MEGA's system and data stay unchanged. No migrations have been added or modified by this PR; earlier SRS FR-033/034 HOLD and its negative regression gates remain in place. Before live generation, signed financial/legal specification must distinguish independent member benefit, compliant payment verification, cancellation/refund, actual entitlement, and each compensation rule. A staff-issued PIN cannot itself establish settlement.

## Engineering acceptance

Exact-head API CI (including compiled NestJS, MySQL regression tests, Super Admin RBAC, member recovery, backup/restore) and Web CI (lint/typecheck/build/mobile+desktop browser UAT) must pass. Local Docker-backed `npm run verify` remains an independent handoff gate. No draft PR is merged or deployed automatically.
