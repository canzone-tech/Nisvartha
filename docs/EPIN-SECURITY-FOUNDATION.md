# E-PIN security foundation — code without financial issuance

**Status: nonfinancial implementation preparation, NOT an E-PIN generator or activation endpoint.**
1 November 2026; parent branch `dev/phase3-super-admin-rbac`, draft PR #6.

## Current requirement

The stakeholder selected paid joining through Admin/Super Admin-issued E-PINs, with those roles verified operationally by the stakeholder. Actual payment proof, settled order policy, legal opinion and the signed SRS FR-033/034 financial change request have not been provided. The SRS v1.0 §6.5 explicitly excludes live enrollment/payment/commission/placement until approval. A staff user's verified identity does not prove receipt of settled funds.

## Implemented, deliberately limited

- `backend/src/security/opaque-credential.ts`: reusable cryptographically random 32-byte bearer generator and domain-separated SHA-256 digest for high-entropy **machine-generated** credentials. This is not a database-issued or payable E-PIN. No E-PIN-related route, tables, transaction, settlement, member entitlement, redemption or status exists.
- The existing password-recovery service uses this shared primitive, preserving exactly the old `nisvartha:member-recovery:v1:` hash, issued code format, expiration and single-use DB behavior. Existing recovery credentials remain valid and independently scoped.
- `scripts/test-opaque-credential.mjs`: canonical 256-bit encoding, 2,048-token collision regression, malformed token and purpose rejection, domain separation and deterministic compatibility with the previously deployed recovery hashing contract.
- API CI and root `npm run verify` run the new test **after** compiled backend build. Existing real-MySQL recovery, concurrency, RBAC and compiled-web tests remain unchanged.
- SRS paid E-PIN HOLD checks, frontend, schema, migrations and approved staff permissions remain unchanged in this PR.

## Conditions for actual paid Admin/Super Admin generator

After signed scope and independent India-specific legal/finance clearance, implement **separately**:
1. An approved real product/offer and merchant/payment record for each E-PIN; price/taxes/refunds and settlement authority agreed.
2. Restricted ADMIN/SUPER_ADMIN issuance with a verified active staff session, any required step-up, precise permissions, batch and recipient policy, quotas and immutable audit trail; not automatically offered by this generic primitive.
3. Authoritative pending/settled/refunded payment states; signed provider event validation, unique idempotency keys, reconciliation, cancellation and disputes. A staff click cannot mark a payment settled.
4. Hash-only PIN persistence with single secure plaintext handover and optional beneficiary assignment; one-time MySQL redemption with row locks/conditional updates and separate staff membership approval.
5. Tests covering concurrent issuance/redemption, replay, owner mismatch, inactive staff, refunds/chargebacks, secret exposure, fail-closed deployment and all original recovery regressions.

Do not use this cryptographic helper to process passwords or any low-entropy human-selected PIN (SHA-256 hashing alone would not protect guessable secrets); its correctness does not establish a legal, commercial, or settlement approval.
