# E-PIN / signup / referral — phased delivery, financial HOLD preserved

**Requested 4 November 2026:** generate registration E-PINs, support signup using an E-PIN, and record referrals. This is stakeholder intent, not a signed revision of SRS v1.0 FR-033/034 or authorization to sell/issue paid credentials or operate a recruitment-based reward scheme.

## Step 1: synthetic generation candidate preview (implemented)
- Reuse the existing audited *pure* `prepareEpinBatch` generator, purpose-separated 256-bit bearer secrets and strict quantity (1–500) / timezone-bearing future expiry validation.
- Only a developer explicitly opting in on a nonproduction machine can run `NISVARTHA_UAT_EPINS=UNISSUED_ONLY npm run uat:epin-candidates -- --quantity=20 --expires-at=2099-01-31T23:59:00+05:30`.
- Output is a new owner-only JSON file within a fresh private temporary folder; the CLI prints the path but no secrets. Each secret is marked **unissued, unredeemable, unusable for member signup** and should be deleted after synthetic inspection.
- No API, Prisma migration, inventory, money, live member creation, referral, wallet or payment state is introduced. This is a working generation demonstration **not** a working issuer.
- Negative fixtures in the root Docker-backed `npm run verify` and API CI reject production/implicit use, invalid input, duplicates and output leakage.

## Step 1B: public and staff-assisted nonfinancial membership applications
- Existing public `/member/register` retains policy/version controls and PENDING/SUBMITTED results.
- The new authenticated, ADMIN/SUPER_ADMIN-only `POST /api/v1/cms/membership/applications/register` requires `MEMBER_STAFF_REGISTRATION_ENABLED=true` and the existing member portal/application policy gates. Applicant must be present, select their own password, approve terms/privacy and provide a private opaque consent evidence reference.
- Both paths share `MemberService.register()` and one authoritative MySQL transaction. Append-only migration `0010` stores intake source, staff actor and evidence register ID. Audit log contains no personal data or credentials. Admin UI appears within Membership only when the policy gates are approved.
- Neither path can consume synthetic candidate codes, issue E-PINs, create payment receipts, activate membership automatically or grant referral rewards. Local synthetic UAT leaves registration OFF by default; opt into fake-identity browser UAT via `NISVARTHA_UAT_MEMBERS=synthetic npm run uat:local`. Never use real applicant data in that disposable sandbox.

## Step 2: legitimate E-PIN issuance and signup (not yet authorized)
Before real implementation: approve a revised signed SRS, member offer/eligibility and terms/privacy, legal opinion on actual commercial/foundation programme, payment settlement/refunds (if paid), authorized operator and secure distribution policy. Reuse existing `MemberAccount(PENDING)` and `MembershipApplication(SUBMITTED)`, never silently auto-approve. Design authoritative Prisma/MySQL records and append-only migrations for an approved order/settlement if applicable, immutable issued PIN history, idempotent batch request and single-use redemption with row lock; no payment by PIN possession alone. Rate-limit generic invalid-code responses, prevent replay and double registration, and test concurrent signup. No need for email verification *only if* a reviewed alternative identity process is approved.

## Step 3: referral attribution (not yet authorized)
Clarify whether the referrer is simply an inviter, and whether referral is optional. A conservative nonfinancial design may record one immutable inviter attribution attached to a pending application, with self-referral/cycle/duplicate checks and applicant privacy controls. **Do not** implement monetary direct-referral rewards, 1:3 forced matrix placement, rebirth, wallets, balances or payouts from the supplied flyer. Those require independently approved lawful programme scope and accounting; a member's referral alone never creates money or entitlement.

## Scope / verification
SRS v1.0 is draft and excludes payment/referral compensation until separate sign-off. Keep `scripts/check-paid-epin-hold.mjs`, existing member registration gates and `PUBLIC_CONTENT_APPROVED=false` / member controls intact. This preview is a source/UAT tool, not a production feature or approval to deploy.
