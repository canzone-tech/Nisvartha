# Nisvartha: one-command local verification and browsable UAT

**Scope:** Disposable local release-candidate testing. Default UAT is synthetic/nonfinancial; the optional member-flow rehearsal enables the offline activation/earnings screens with fake identities and fake external references only. No production host, live payment transfer, real member enrollments, staff emails or Foundation identity data. Designed for an Ubuntu/Linux development workstation with **Node.js 22, npm, Docker Compose v2, and Chromium/Chrome**.

## One command for automated regression verification

From the checked-out release branch, run:

```bash
npm run verify
```

It installs locked dependencies; validates scope and release configurations; compiles NestJS and Next.js; migrates an **isolated MySQL 8.4**; tests actual compiled API, security/RBAC, CMS, enquiries, member workflows, read-only E-PIN security contracts, migrations, media, **paired DB+WebP backup/restore**, browser routes and mobile/desktop screenshots. All feature gates are forced to OFF except internally controlled CI test fixtures. It does **not** connect to production or start persistent services.

Local safety protections:
- Docker Compose uses a **random, unique project name**; cleanup can only remove that project's disposable data. Test MySQL binds loopback port **33306** by default; override with `NISVARTHA_VERIFY_DB_PORT` if it conflicts (valid 1024–65535).
- The synthetic media scanner is copied to a private temporary directory with executable permissions. The tracked `scripts/ci-media-scanner.sh` is **never chmod'ed**. Original tracked Git status is compared after tests; a new unintended tracked diff fails verification.
- Feature flags and `DATABASE_URL` are set to isolated local defaults and personal-data collection, public indexing, member applications and payment remain blocked.
- The command validates Docker daemon access and Chromium availability before starting containers; missing prerequisites produce an error rather than a false PASS.
- CI additionally runs the same local-launcher's one-shot compiled stack, so a valid script without working compiled runtime/login is not enough to pass.

**IMPORTANT:** Never run this command on a production host; it creates/removes disposable containers and databases. No startup test here proves production domain/TLS, real backups or approved Foundation content.

## Docker-free frontend verification

If the workstation does not yet have Docker, run:

```bash
npm run verify:web-local
```

This uses the **same script as Web CI**: locked frontend install, scope/release/launcher safety checks, lint, TypeScript, clean compiled Next.js build, public route smoke and Chromium mobile/desktop browser UAT. It forces unapproved forms, indexing and membership OFF. It does **not** run a real MySQL, compiled NestJS API, CMS persistence, staff authentication or DB backup; those still require `npm run verify` and its disposable Docker MySQL.

## One command to open a local website and CMS in your browser

```bash
npm run uat:local
```

This starts compiled NestJS and Next.js on **127.0.0.1:3100** and **127.0.0.1:3102**, with a separate, randomly named disposable MySQL Compose project on loopback port **33307**. It uses a private temporary media folder and a **test fixture** scanner (not actual malware scanning). It automatically migrates the test DB, builds both applications, bootstraps a synthetic local-only **ADMIN** using the existing trusted-host bootstrap and provisions a separate **APPROVER** through the actual audited staff API. Temporary randomly generated login credentials are printed **only in your local terminal**, never committed, hardcoded or used by production. A compiled web/API + browser BFF smoke must pass before the script announces the environment ready.

Open **http://127.0.0.1:3102** for public pages and **http://127.0.0.1:3102/admin/login** for staff CMS.

### Simple Foundation dashboard (3 November UX correction)

The authenticated `/admin` landing page now shows a compact **Foundation overview**, approval/enquiry counts and task shortcuts—not every form at once. Use the role-scoped sidebar to switch between dedicated URLs: Content workspace (`/admin/content`), Photos & gallery (`/admin/gallery`), Enquiries (`/admin/enquiries`), Membership (`/admin/members`), Staff (`/admin/staff`), Audit (`/admin/audit`), held E-PIN preview (`/admin/epin`) and gated recovery (`/admin/recovery`). The overview remains `/admin`. Each page is server-rendered, deep-linkable and protected by staff authentication and role checks. Legacy `/admin?view=...` bookmarks redirect to the corresponding dedicated page; forbidden pages redirect to the safe overview, while unknown paths are not valid workspace sections. Backend API RBAC remains authoritative.

All existing CMS, upload, review, audit, staff and E-PIN-preview workflows are retained with **exactly one active panel at a time**. The E-PIN control is validation-only; there are no live payment or issuance operations. Compiled local UAT now checks the focused landing, each workspace, invalid views and APPROVER isolation. Existing synthetic test data are disposable—Ctrl+C stops the launcher and deletes its temporary database, so do not store real organizational content in it.

The local UAT workflow is:

1. Sign in with the displayed synthetic **ADMIN** account; create/edit a synthetic CMS project or informational page and submit its revision.
2. Sign out and use the displayed independent **APPROVER** account to review/approve that revision. Authors cannot approve their own work.
3. Check the approved project or content on public pages and review the draft/preview/archive behavior, staff RBAC, audit, privacy gates and responsive design.
4. Verify public enquiry forms, paid E-PIN issuance/1:3 financial pages and real member registration remain **disabled**. To test functional enquiries, recovery, session review or media operations, rely on the isolated real-MySQL automated `npm run verify` suite; do not open real collection flows using unapproved policies.

**Press Ctrl+C** to stop the UAT session. The script stops only its compiled processes and randomly named MySQL project, removing synthetic test data and temporary credentials/media. No existing Git branch, migrations or production data are modified. UAT application logs reside only in temporary private files during the session, and are deleted at exit.

If the default ports are occupied, set `NISVARTHA_UAT_API_PORT`, `NISVARTHA_UAT_WEB_PORT`, or `NISVARTHA_UAT_DB_PORT` to unused loopback ports. A port conflict fails before any database mutation. A local browser UAT run is **not** a green replacement for `npm run verify`.

### Optional synthetic public + Admin member registration UAT

The default `npm run uat:local` intentionally leaves member signup disabled. For **synthetic fake identities only**, start the same disposable loopback stack with `NISVARTHA_UAT_MEMBERS=synthetic npm run uat:local`. This opt-in sets test-only terms/privacy versions and enables `/member/register` plus the ADMIN/SUPER_ADMIN form under `/admin/members`. The applicant must be present and enter their own password; use only an invented evidence register ID (for example `CONSENT-UAT-2026-0001`). All records vanish when the launcher exits. Do not use real applicant names/emails, claim approved Foundation privacy notices or enable on a production host. Neither route accepts E-PINs or payment.

## Complete member-flow browser rehearsal

To manually test the implemented member business flow in the same disposable local stack, run:

```bash
npm run uat:local:member-flow
```

This is an **interactive local-only rehearsal with fake identities and fake external references**. It starts compiled NestJS + Next.js and disposable MySQL, enables registration E-PIN inventory, member applications, persistent 1:3 matrix placement and earnings/settlement screens, but it does **not** call a bank, UPI provider, payment gateway or create a spendable wallet.

After the launcher prints the temporary ADMIN credentials:

1. Open `http://127.0.0.1:3102/admin/login`, sign in, then open **E-PIN inventory** and create registration E-PINs.
2. Open `http://127.0.0.1:3102/member/register` in another browser/private window and register a fake member using one E-PIN.
3. In **Admin → Members**, review the application. For approval enter a fake offline transaction reference/evidence and received date/time; the amount is fixed server-side at **₹15,000**.
4. For direct-referral testing, approve the first member, copy their invitation link/code, create another E-PIN and register the second fake member through that invitation. After approval, verify the first member shows the **₹1,000** direct earning.
5. Open the member **1:3 Matrix** and **Earnings** views, and the corresponding Admin member views. Level and rebirth behavior uses the same production code exercised by `npm run verify`.
6. To test settlement, use **Admin → Members → Earnings & settlements**, enter a fake bank/UPI/cash reference/evidence after pretending the external payment was made, and mark the earning settled.

Press **Ctrl+C** when finished. The default member-flow command removes its randomly named MySQL volume and all fake records. Do not use real people, real transaction references or production credentials.

## CI parity and acceptance

- `node scripts/test-local-uat.mjs` checks launcher syntax/isolation/security contracts and positive/negative local smoke fixtures in both API and Web CI.
- **Local Parity CI** runs the exact root `npm run verify` on a clean GitHub runner with disposable Docker MySQL and Chromium, rather than assuming that separate API/Web jobs reproduce the complete local script.
- API CI runs `NISVARTHA_UAT_ONESHOT=true bash scripts/local-uat.sh`, reusing the actual local launcher, doing the migrations, production-style builds, HTTP and synthetic **ADMIN + APPROVER** authentication/RBAC smoke, then cleanup without leaving a server or printing credentials.
- Run `npm run verify` on the intended local development host and preserve output before accepting local parity. This chat execution environment has **no Docker daemon**, so an independent interactive/local root verify cannot be claimed green here. The exact-head API/Web CI is reported separately.
- The local UAT environment remains **not** an approved public production release. Official content, privacy, live TLS, real offsite backup/restore and legal/financial gates remain external blockers.

**Handoff after successful review and branch integration:** `git pull` then `npm run verify`. Use `npm run uat:local` only when a browsable manual UAT is needed.
