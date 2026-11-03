# E-PIN bearer verification and inventory transaction design (HOLD)

**Sources inspected:** Nisvartha SRS v1.0 §6.5, FR-033/034; current `backend/src/security/{opaque-credential,epin-batch,epin-redemption-preconditions}.ts`; `canzone-tech/megamitra` `dev/local-foundation` issuance/revocation and row-locked registration patterns. This is an engineering security contract, **not** a signed replacement for the financial SRS or legal approval.

## Delivered: read-only, testable bearer verifier

`matchesEpinBearer(storedHash, presentedCode, expectedType)` in `backend/src/security/epin-bearer-verification.ts`:

- Accepts only canonical, unpadded, 43-character base64url encoding of a 32-byte (256-bit) bearer. Rejects padded, malformed, noncanonical and incorrect-length inputs without throwing, exposing or logging them.
- Requires an authoritative 64-character lowercase SHA-256 digest and uses `hashOpaqueCredential` **without changing the existing hash format**. The sole Nisvartha E-PIN namespace is `epin-activation`, used for one-time registration. Legacy `epin-installment` and independent `member-recovery` digests cannot authenticate a registration PIN.
- Uses Node.js `timingSafeEqual` to compare well-formed digest bytes in constant time. Parsing/validation and surrounding network/DB paths are **not** claimed to be constant-time; public responses must still be generic and rate-limited.
- Returns a boolean only. Does **not** create a PIN, query a DB, change inventory status, authorize payment, grant a member right, credit rewards, or redeem anything.
- Composes in a **future, separately approved** service with the existing pure `assertEpinRedemptionPreconditions` that checks status/expiry/type/assignment/session/snapshot. Passing **both** checks is still insufficient to authorize payment or a claim.

## Composed registration evidence — non-issuing security helper

`matchesRegistrationPinEvidence(snapshot, presentedCode, context)` combines existing `matchesEpinBearer` and `assertEpinRedemptionPreconditions` within the same pure security module. It returns a boolean, never an entitlement, receipt or redeem authorization. The snapshot extends the existing registration-only metadata shape with the authoritative `codeHash`; a future caller must obtain that stored record from the actual MySQL inventory under its transactional concurrency rules.

- Wrong/malformed bearer or digest, MEGA installment purpose/metadata, expired/used/revoked status, other member/session, unpublished programme, invalid currency/registration snapshot or malformed context all return `false` without exposing internal failure reasons.
- A `true` result proves **only** a matching high-entropy bearer and currently acceptable supplied metadata. It **does not** check real settlement/chargebacks, prove the record was actually issued, reserve inventory, mark it used, grant membership or avoid double-spend races.
- This composes existing functions instead of duplicating their crypto or status business rules. It remains a pure function without imports from NestJS/Prisma, HTTP routes, new dependencies or migrations.
- The compiled `scripts/test-epin-bearer-verification.mjs` now verifies combined failure cases, synthetic replay after `USED`, cross-domain credential rejection and no mutation; `scripts/check-paid-epin-hold.mjs` additionally asserts the helper stays unmounted and read-only. These guards run in API CI and local `npm run verify`.

## Held E-PIN inventory / atomic redemption contract (design only)

An authoritative MySQL record (schema **not yet added**) eventually needs: unique server-generated ID, unique domain-separated `codeHash`, nonsecret display suffix, one registration-only `ACTIVATION` type, `sessionId`, assigned beneficiary when applicable, issued-at and expires-at, explicit `ACTIVE/USED/REVOKED` state and timestamps, signed-approval/issuer metadata, source order/payment/settlement ID, and immutable audit references. No financial amount, return, commission, 1:3 level or entitlement can be assumed from code possession.

Future issuance must **only** follow a legitimate independently reviewed product/service sale and a confirmed authoritative payment settlement, with merchant webhook signature verification and idempotent order/settlement references. Staff policy preview/candidates are not issued inventory; no bearer from a preview may become live without that approved transaction.

Future one-time redemption must use an authoritative MySQL transaction with a unique hashed bearer lookup and **row locking** or equivalent atomic conditional update; verify source settlement and non-refund state, member/session/issuance binding, cryptographic possession and metadata preconditions, then atomically update from `ACTIVE` to `USED` while recording the same claimant, operation idempotency key and immutable audit. Unique constraints and conditional update affected-row checks must reject double-claim races; repeat requests must return the original authorized outcome **only** for an exactly matching idempotency fingerprint, never grant a second entitlement. Commit member grant and PIN claim together or commit neither. Cancellation/refund should be a distinct audited lifecycle with defined clawback/refund policy. Concurrency and money-source reconciliation belong to the future **real DB integration test suite**, not this pure helper.

## Regression and release boundary

`scripts/test-epin-bearer-verification.mjs` validates the compiled verifier against existing generated synthetic candidates, registration-only type enforcement, rejected legacy installment type, recovery namespace cross-use, 128 random wrong bearer attempts, malformed/stored hash inputs, noncanonical same-byte base64url, and a **synthetic used/revoked metadata replay example**. The replay example checks already-existing precondition logic only; it does **not** claim to prove transactional concurrency, idempotency or single-use database enforcement.

This test is run by API CI and root `npm run verify` after compiling NestJS. The existing `check-paid-epin-hold.mjs` refuses any DB/controller coupling for this helper. No migration, E-PIN payment record, HTTP issuance, redemption API, public buyer flow, activation, wallet, commission, matrix or payout is added.

**Business decision:** user approved discussing/developing paid E-PIN, commission and 1:3 plan in principle on 2026-11-02. **Separate prerequisite remains:** signed revised SRS, independent counsel review for the specific commercial/compensation scheme, accounting funding and authorized deployment; see `docs/FINANCIAL-SCOPE-BUSINESS-APPROVAL-2026-11-02.md`. Do not treat this technical contract as legal clearance or a financial feature release.
