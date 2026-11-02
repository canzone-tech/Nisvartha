# Nisvartha — MEGA-derived E-PIN redemption metadata checks

**Source inspected:** `canzone-tech/megamitra` `dev/local-foundation`, `backend/src/auth/member-registration.service.ts`: `assertPaidEpin()`, `epinLookupSql(true)`, registration's row-locked E-PIN consumption, and `backend/src/owner-portal/owner-portal.service.ts` issuance/revocation. This adaptation is intentionally not the MEGA binary genealogy, Lucky Draw, installment funding, paid enrollment, payment ledger or participant registration service.

## Existing business boundary

Under Nisvartha SRS v1.0 FR-033/034, actual member-paid E-PIN issuance, redemption, payment/settlement, compensation and 1:3 placement remain on signed financial/legal HOLD. The existing ADMIN/SUPER_ADMIN dashboard validates proposed batch *metadata* only; it generates and issues **zero** PINs. The contract below does not replace merchant settlement or legal sign-off.

## Source-aligned, reusable implementation

`backend/src/security/epin-redemption-preconditions.ts` provides one **pure** method, `assertEpinRedemptionPreconditions(record, context)`, for a future *authoritative, issued and row-locked* E-PIN record. It checks:

- Record exists, remains `ACTIVE`, was not used or revoked, and has a valid future expiry. A missing/used/revoked/expired record receives one generic public-safe error message.
- The requested `ACTIVATION` or `INSTALLMENT` type matches the record; no cross-type redemption.
- An explicitly assigned member, if present, matches the applicant. This is intentionally stricter than MEGA's basic `assertPaidEpin` check; a future binding policy must preserve or strengthen this defense.
- An actual session binding matches the intended session, the session is `ACTIVE` and the program version is `PUBLISHED`.
- Registration/installment commercial snapshots are present and syntactically valid decimal strings; the currency code matches the bound session, and the installment count is a positive integer.

A failed check throws `EpinRedemptionPreconditionError` with internal rejection codes and a generic message. No raw bearer, secret, price assumption, payment record, state change, member activation, referral/matrix operation, live E-PIN lookup or inventory exists here.

Passing this method **does not** mean a payment settled or a member is entitled to activate. The eventual transactional redemption service must still verify a settled authoritative merchant/order record, an approved offer/terms, the actual issued E-PIN's hash and member/session ownership, idempotency keys, refund/reversal policy, row lock or conditional update, a unique single-use claim, and an audit entry in one DB transaction. Never use this method's result to activate a member by itself.

## Verification and limitations

`scripts/test-epin-redemption-preconditions.mjs` covers valid and rejected types, missing/used/revoked/expired pins, assignment and session mismatch, invalid snapshots, currency mismatch, malformed clocks and uniform error messages, including no side effects. Root `npm run verify` and API CI run compiled artifact tests; SRS scope gate blocks DB/controller coupling.

There is **no new migration, E-PIN controller, payment integration, user-facing redemption endpoint, cash balance, reward, payout, referral or placement** in this change. MEGA files and production remain untouched. Read-only source adaptation can be reviewed independently; live financial functionality awaits the existing signed approval and separate authorization.
