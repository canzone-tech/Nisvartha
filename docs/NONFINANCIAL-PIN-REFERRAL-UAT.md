# Synthetic membership E-PIN and inviter attribution UAT

**Scope:** Code-based registration for synthetic local testing only. This is **not** the ₹15,000 paid membership programme nor a lawful approval to operate the flyer compensation plan.

## One-command user acceptance
Run on the dedicated developer machine against a clean feature branch:

`NISVARTHA_UAT_MEMBERS=synthetic NISVARTHA_UAT_PIN_FLOW=synthetic npm run uat:local`

Use only fake identities with `@example.invalid` and a fake consent register ID. In `/admin/epin`, an ADMIN selects a future expiry and quantity 1–50 and generates synthetic E-PINs. Each batch has a unique request UUID; full PINs are AES-256-GCM encrypted at rest and visible again in the authenticated Admin inventory with audited reads. Plaintext is never stored in MySQL or audit records. The local vault key and the entire disposable DB are discarded when UAT stops. At `/member/register`, register the first fake applicant using a code; it becomes PENDING and its application SUBMITTED. Separately sign in as the synthetic APPROVER, review/approve it, then sign in as the fake member to see the nonfinancial invite code. Register a second fake applicant, entering another unredeemed E-PIN and the first applicant's invite code. The first member's invitation count increases. The same test E-PIN also works in the ADMIN assisted form if the applicant is present and supplies a private consent evidence reference. Reusing a PIN or invalid inviter must fail.

## Controlled data and money boundary
- Production default has no E-PIN issuance or redemption. Server fails closed if NODE_ENV is production or database is not a local `nisvartha_ci` fixture.
- Signed SRS v1.0 forbids paid issuance, live ₹1,000 recruitment commission, 1:3 matrix, rebirth, wallet, payout and joining fee workflows pending independent legal, financial and governance approval.
- No referral income, payable, ledger, balance, payout or placement is calculated, accrued or stored. An inviter is only a one-level identity link; no chain.
- The 1978 money-circulation law and 2021 Consumer Protection (Direct Selling) Rules require independent specialist review of the supplied joining/referral programme before any real enrolment or financial coding. No contractual legitimacy is implied.
- All synthetic account, inviter and PIN records live only in the disposable local MySQL stack; `Ctrl+C` tears that project down. Do not run against a shared DB or production.

## Member referral link and WhatsApp browser UAT

After Admin approval, sign in as the first synthetic member at `/member`.
The Admin-style Member dashboard has an Invitations entry and a shareable invitation panel.
Click **Copy invitation link** or **Share via WhatsApp**; the outbound URL contains only the 22-character inviter code, never an E-PIN, password or member identifier.
The share message explicitly states that this is nonfinancial and requires a separate registration E-PIN and staff review.
A `127.0.0.1` link only works on the same developer machine; **do not distribute this local address to real applicants**.

In the same local browser, open `/member/register?invite=<synthetic-22-character-code>` and confirm the inviter code is prefilled.
Enter another available synthetic E-PIN and register a second `@example.invalid` account.
Repeat Admin review; verify the sponsor's attributed count and **Invitations → Referral genealogy tree**.
The expandable, privacy-masked tree summarizes up to five recorded invitation levels, max 150 nodes. This is **not** automatic matrix placement or a commission genealogy.
Malformed or duplicated query code, consumed PINs, inactive sponsor, unauthorized genealogy and real email addresses must be rejected.

Use `NISVARTHA_UAT_PIN_FLOW=synthetic npm run uat:local` for invitation UAT.
The separate `access` PIN mode intentionally does not activate referral sharing/attribution.
`npm run verify` and CI verify URL validation, generated link contract, built registration autofill and authoritative inviter edges.

## Financial implementation hold

**Referral commission: NOT ENABLED.** No amount, payable, accrual, wallet, settlement, withdrawal or payout is calculated or stored. The provided SRS v1.0, FR-033/034 and section 6.5 require separate written legal, finance and Foundation authorization plus a signed versioned financial specification before financial coding or production activation. Current no-fee invitation UAT is not such authorization.

## 1:3 visual slot verification

Member genealogy presents all three numbered visual slots per occupied parent, including explicit Empty placeholders; this is a visualization of actual direct invitations, not approved forced-matrix placement. The fourth and subsequent direct invitation must appear in a clearly marked overflow area rather than disappear. Expand branches to view deeper level slots. No phantom members or commission credits are written.
