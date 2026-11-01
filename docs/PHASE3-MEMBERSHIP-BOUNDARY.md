# Nisvartha Phase 3 — nonfinancial membership foundation and held compensation plan

**Source:** Nisvartha Foundation SRS v1.0, FR-029–034; stakeholder flyer, 1:3 forced-matrix concept. This feature branch is development-only. No production application or financial programme is approved.

## Scoped technical implementation

- Independent `MemberAccount`, `MemberSession`, `MembershipApplication` and `MemberAudit` records, not MegaMitra customer or binary genealogy tables.
- Applicant registration, login, eight-hour revocable opaque sessions, 14+ character Argon2id password hashing, account lockouts, logout, profile/communication preferences, password change with all-session revocation, application withdrawal.
- Application statuses `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `SUSPENDED`, `WITHDRAWN`. Review/decision endpoints protected by existing staff `ADMIN/APPROVER` roles, atomic status transitions and MySQL audit history.
- Separate Next.js HttpOnly SameSite member session, BFF origin checks, server-rendered member dashboard and staff review panel.
- No member balance, E-PIN purchase, sponsor/placement field, commission, referral credit, rebirth, wallet or payout created by member approval.

## Environment and identity gates

All defaults are **off**: `MEMBER_PORTAL_ENABLED=false` and `MEMBER_APPLICATIONS_ENABLED=false`. Registration additionally requires exact configured, counsel-approved `MEMBER_TERMS_VERSION` and `MEMBER_PRIVACY_VERSION` on client and server. An applicant can see **application status only**; approval is a membership status and has no monetary effect.

Email ownership verification, trustworthy recovery delivery (password reset), optional MFA, age/identity eligibility and approved operator workflow are **not specified** in v1.0. Do not enable production public member registration until these are independently agreed, implemented and tested. Change-password for authenticated members is implemented; **forgot-password reset is pending**, so FR-029 is partial.

One append-only migration `0007_member_accounts` introduces these nonfinancial records. No existing migration is edited. Local `npm run verify` and matching CI use synthetic applicant identities, isolated MySQL and compiled NestJS/Next.js endpoints; their success is not a legal or security accreditation.

## Unresolved fixed 1:3 financial programme

Flyer claims: joining amount ₹15,000; three available positions under each matrix parent; five levels of `3,9,27,81,243` (363 total); direct referral ₹1,000; level payout figures ₹2,500 / ₹5,000 / ₹10,000 / ₹50,000 / ₹90,000 (sum ₹1,57,500); four purported new/rebirth IDs (1 at level 4 and 3 at level 5); sequential top-to-bottom / left-to-right placement. These are **source claims, not verified funding or eligibility rules**.

Missing independent decisions include: what product/service is delivered for consideration; whether referrals or placements are linked to consideration; sponsor-vs-placement ownership; how unlimited direct referrals map into fixed 3-wide positions; simultaneous recruitment locks and cycle handling; reinsertion/rebirth conditions, reserve and liabilities; commission source of funds; reversals, cancellations, refund rights, KYC, tax, risk and settlement; complete financial reconciliation and legal opinion. A flyer cannot settle these contracts.

The SRS expressly excludes live enrolment, fees, matrix placement, payout, rebirth and wallet from its baseline (section 6.5; FR-033/034) and requires signed legal/financial scope before any such development/activation. Indian Consumer Protection (Direct Selling) Rules 2021 prohibit pyramid and money circulation schemes; Prize Chits and Money Circulation Schemes (Banning) Act 1978 is also relevant. Obtain qualified India-specific written review before implementation of anything involving member-paid rewards. Do not silently change MegaMitra binary A-D/LEFT/RIGHT to 1:3.

No payment-processing integration, financial ledger, E-PIN issuance/activation, genealogy placement or automatic payout has been implemented, even in disabled production source. If counsel does not approve the proposed scheme, redesign as a lawful membership/volunteer programme without recruitment-based monetary returns.

## Release acceptance gates

1. Exact-head branch CI success and human local UAT; no claim of completion from compile-only results.
2. Signed membership terms/privacy, application eligibility and verification/reset method.
3. Staff RBAC/access tests, applicant privacy, session revocation, duplicate registration, concurrency, backups and audit.
4. No SRS FR-033/034 payment operations until detailed approved policy + legal opinion + funding reconciliation + safe technical design. Explicit deployment approval separately required.
