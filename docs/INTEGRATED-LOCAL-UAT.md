# NISVARTHA — integrated client-design UAT (nonfinancial synthetic data)

## Single entrypoint
On a dedicated local development host with Docker Compose, Node 22 and a clean feature branch:

```bash
npm run verify
npm run uat:local
```

The interactive launcher now defaults to four synthetic capabilities **together**:
Contact/Volunteer enquiries, public and staff member application, one-time E-PIN generation/redemption with one-level inviter attribution, and the supplied informational Auto Pool review page. All public screens use the same approved client v1.1 design and unchanged client source wording. The active Next.js routes (not inert static rewrites) own backend integration, and the Admin workspace uses the same design tokens.

- `http://127.0.0.1:3102/contact`: original client page, with a visually client-matched **official local UAT form** appended. The demo-only source form is hidden when the real form is enabled; the original source copy remains unchanged.
- `http://127.0.0.1:3102/volunteer`: same; submitted interests and availability are persisted with a consent version into isolated MySQL.
- `http://127.0.0.1:3102/admin/members`: create one-time synthetic E-PINs, then use staff-assisted member intake. The launcher displays temporary local ADMIN/APPROVER credentials only in the terminal.
- `http://127.0.0.1:3102/member/register`: use an unused synthetic E-PIN for fake public signup; approval follows the separate reviewer path. Once an application is approved, the member can see their nonfinancial invitation code. Use another unused PIN plus that code to attribute one direct invitation.
- `http://127.0.0.1:3102/auto-pool-plan`: verbatim client review notice; no financial activation, placement or payout processing.

**Only invented data:** use email addresses ending `@example.invalid`, fake names, test-only phone details and synthetic consent evidence. Synthetic privacy versions are hard-rejected on real/production databases; E-PIN flow has the same isolated-db restrictions. The launcher uses a private loopback-bound MySQL 8.4 container and `Ctrl+C` destroys its disposable Compose project. A test scanner fixture is **not** production ClamAV.

## Control switches
Interactive defaults: `NISVARTHA_UAT_FORMS=synthetic`, `NISVARTHA_UAT_MEMBERS=synthetic`, `NISVARTHA_UAT_PIN_FLOW=synthetic`, `NISVARTHA_UAT_PLAN=synthetic`.

Each flag accepts `off` to disable it. E-PIN synthetic mode requires member synthetic mode. `NISVARTHA_UAT_CLIENT_TEMPLATE=exact` deliberately selects the byte-identical **static visual comparison**; forms in that strict static preview are demonstrative. The default `off` for the static template selects functional Next.js with the same source content and design. `NISVARTHA_UAT_ONESHOT=true` (used by API CI) defaults all synthetic capabilities OFF, matching production policy.

## What this does not imply
This local UAT enables *working nonfinancial test journeys*, not the proposed ₹15,000 fee/₹1,000 recruitment commission, 1:3 forced-matrix payments, re-entry accounts, payout balances, donation collections or actual payments. The client auto-pool page explicitly calls these **unverified**. SRS v1.0 excludes operating them before specialist legality review and a reconciled source-of-funds/benefit/refund/tax policy; client approval of the website design/copy does not supply those contracts. Under the Consumer Protection (Direct Selling) Rules 2021, pyramid and money-circulation schemes cannot be operated by a direct-selling entity in their guise. No payment/commission engine has been added by this PR.

Production flags remain approved-policy gated; `main`, release and deployed systems are unchanged. Root `npm run verify` and API CI cover synthetic form rejection, idempotency and real MySQL; client visual/copy integrity tests remain.
