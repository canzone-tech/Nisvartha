# Synthetic membership E-PIN and inviter attribution UAT

**Scope:** Code-based registration for synthetic local testing only. This is **not** the ₹15,000 paid membership programme nor a lawful approval to operate the flyer compensation plan.

## One-command user acceptance
Run on the dedicated developer machine against a clean feature branch:

`NISVARTHA_UAT_MEMBERS=synthetic NISVARTHA_UAT_PIN_FLOW=synthetic npm run uat:local`

Use only fake identities with `@example.invalid` and a fake consent register ID. In `/admin/members`, an ADMIN selects a future expiry and quantity 1–50 and generates synthetic E-PINs once. The batch request has a unique UUID; codes appear once and never enter the DB or audit in plaintext. Copy a code privately before navigating away. At `/member/register`, register the first fake applicant using a code; it becomes PENDING and its application SUBMITTED. Separately sign in as the synthetic APPROVER, review/approve it, then sign in as the fake member to see the nonfinancial invite code. Register a second fake applicant, entering another unredeemed E-PIN and the first applicant's invite code. The first member's invitation count increases. The same test E-PIN also works in the ADMIN assisted form if the applicant is present and supplies a private consent evidence reference. Reusing a PIN or invalid inviter must fail.

## Controlled data and money boundary
- Production default has no E-PIN issuance or redemption. Server fails closed if NODE_ENV is production or database is not a local `nisvartha_ci` fixture.
- Signed SRS v1.0 forbids paid issuance, live ₹1,000 recruitment commission, 1:3 matrix, rebirth, wallet, payout and joining fee workflows pending independent legal, financial and governance approval.
- No referral income, payable, ledger, balance, payout or placement is calculated, accrued or stored. An inviter is only a one-level identity link; no chain.
- The 1978 money-circulation law and 2021 Consumer Protection (Direct Selling) Rules require independent specialist review of the supplied joining/referral programme before any real enrolment or financial coding. No contractual legitimacy is implied.
- All synthetic account, inviter and PIN records live only in the disposable local MySQL stack; `Ctrl+C` tears that project down. Do not run against a shared DB or production.
