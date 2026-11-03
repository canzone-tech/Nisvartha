# Nisvartha: one-command local verification and browsable UAT

**Scope:** Entirely synthetic, nonfinancial release candidate. No production host, live payments, real member enrollments, staff emails or Foundation identity data. Designed for an Ubuntu/Linux development workstation with **Node.js 22, npm, Docker Compose v2, and Chromium/Chrome**.

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

## One command to open a local website and CMS in your browser

```bash
npm run uat:local
```

This starts compiled NestJS and Next.js on **127.0.0.1:3100** and **127.0.0.1:3102**, with a separate, randomly named disposable MySQL Compose project on loopback port **33307**. It uses a private temporary media folder and a **test fixture** scanner (not actual malware scanning). It automatically migrates the test DB, builds both applications, bootstraps a synthetic local-only **ADMIN** using the existing trusted-host bootstrap and provisions a separate **APPROVER** through the actual audited staff API. Temporary randomly generated login credentials are printed **only in your local terminal**, never committed, hardcoded or used by production. A compiled web/API + browser BFF smoke must pass before the script announces the environment ready.

Open **http://127.0.0.1:3102** for public pages and **http://127.0.0.1:3102/admin/login** for staff CMS. The local UAT workflow is:

1. Sign in with the displayed synthetic **ADMIN** account; create/edit a synthetic CMS project or informational page and submit its revision.
2. Sign out and use the displayed independent **APPROVER** account to review/approve that revision. Authors cannot approve their own work.
3. Check the approved project or content on public pages and review the draft/preview/archive behavior, staff RBAC, audit, privacy gates and responsive design.
4. Verify public enquiry forms, paid E-PIN issuance/1:3 financial pages and real member registration remain **disabled**. To test functional enquiries, recovery, session review or media operations, rely on the isolated real-MySQL automated `npm run verify` suite; do not open real collection flows using unapproved policies.

**Press Ctrl+C** to stop the UAT session. The script stops only its compiled processes and randomly named MySQL project, removing synthetic test data and temporary credentials/media. No existing Git branch, migrations or production data are modified. UAT application logs reside only in temporary private files during the session, and are deleted at exit.

If the default ports are occupied, set `NISVARTHA_UAT_API_PORT`, `NISVARTHA_UAT_WEB_PORT`, or `NISVARTHA_UAT_DB_PORT` to unused loopback ports. A port conflict fails before any database mutation. A local browser UAT run is **not** a green replacement for `npm run verify`.

## CI parity and acceptance

- `node scripts/test-local-uat.mjs` checks launcher syntax/isolation/security contracts and positive/negative local smoke fixtures in both API and Web CI.
- API CI runs `NISVARTHA_UAT_ONESHOT=true bash scripts/local-uat.sh`, reusing the actual local launcher, doing the migrations, production-style builds, HTTP and synthetic **ADMIN + APPROVER** authentication/RBAC smoke, then cleanup without leaving a server or printing credentials.
- Run `npm run verify` on the intended local development host and preserve output before accepting local parity. This chat execution environment has **no Docker daemon**, so an independent interactive/local root verify cannot be claimed green here. The exact-head API/Web CI is reported separately.
- The local UAT environment remains **not** an approved public production release. Official content, privacy, live TLS, real offsite backup/restore and legal/financial gates remain external blockers.

**Handoff after successful review and branch integration:** `git pull` then `npm run verify`. Use `npm run uat:local` only when a browsable manual UAT is needed.
