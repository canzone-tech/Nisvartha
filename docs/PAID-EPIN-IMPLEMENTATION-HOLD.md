# Nisvartha paid E-PIN: implementation HOLD and acceptance contract

**Recorded 1 November 2026:** Stakeholder requests MEGA-like **paid E-PIN joining**, without mandatory automated email verification. This is the intended business behavior, **not** written authorization to collect money, sell/issue/redeem paid PINs, activate paid memberships or implement recruitment compensation.

## Source-of-truth and outstanding authorization

Nisvartha SRS v1.0, §§2.4 and 6.5 / FR-033–034 exclude live payments, E-PIN activation, matrix placement, referral rewards, wallets and payouts. The ₹15,000 joining amount and 1:3 reward statements are unverified owner-supplied inputs, not a signed lawful price/offer or a settlement schedule.

Before introducing any financial schema/endpoints, obtain:
1. Written India-specific legal review of the Foundation's entity authority, precise product/service, paid membership and entry-fee applicability, direct selling/pyramid/money circulation restrictions, and any voucher/PPI requirements. Remove impermissible referrals, matrix or reward dependence; don't rebrand it as E-PIN.
2. Trustee/product approval of actual independent member benefits, identity policy without automated email verification, PIN purpose and handover, membership approval state, refund/cancellation and published disclosures.
3. Finance approval of pricing, tax/invoicing, payout-independent funding, provider settlement definition, reversals/chargebacks and reconciliation.
4. Signed change-control SRS with roles, API/database contract, acceptance fixtures, privacy/retention and controlled release/deployment authorization.

## Approved-to-design, NOT approved-to-build financial contract

A later **lawfully authorized** payment/activation feature must keep separate authoritative MySQL records for an approved offer, order, actual settled payment, single-use E-PIN, redemption and existing member application. UI redirect, screenshots, initiated payments or unauthenticated webhooks are never settlement. Use validated provider signatures, unique idempotency keys, row locks and atomic redemption linked to member creation. Handle chargebacks and refunds with append-only audit and entitlement review; never silently delete history. A redeemed PIN should create `MemberAccount(PENDING)` + `MembershipApplication(SUBMITTED)` by default; an approved staff decision alone transitions an application. It must never award referral, matrix, wallet, payout or rebirth rights. Existing one-time **password recovery** is an independent mechanism and must not accept paid activation PINs.

## Executable HOLD regression

`scripts/check-paid-epin-hold.mjs` verifies selected member service/controller, Prisma, migration and member-file boundaries and executes self-tests with forbidden financial fixtures. It is invoked by `scripts/check-scope.mjs`; root `npm run verify`, API CI and Web CI now run that gate. The guard is a regression tripwire, not a security boundary or legal certification. A future *signed* scope revision must replace it with properly reviewed contract/financial tests rather than merely deleting the assertions.

No payment route, E-PIN issuer, paid redemption, migration, amount, provider integration, compensation engine or live feature flag was implemented by this change. No production release is authorized.

**References:** SRS v1.0; stakeholder draft `NIS-FND-CR-EPIN-001` v0.2 (not signed); `docs/PHASE3-MEMBERSHIP-BOUNDARY.md`; PR #4 for separate member password recovery. MEGA is read-only pattern reference, not code or data donor.
