# Nisvartha nonfinancial production release: executable technical checklist

**Scope:** The 3 November 2026 consolidated source/UAT branch. The repo implements a self-hosted Next.js 16 frontend, NestJS API on loopback, MySQL 8.4 via Prisma, and a private local media directory. The files here are **reviewable release references**, not a claim that the site has been deployed.

## Verified technical changes in this release

- `scripts/release-preflight.mjs` refuses a production config with missing/placeholder public HTTPS origins, test database, root MySQL user, non-loopback API host, temporary media root, non-ClamAV production scanner, unapproved privacy/content combinations or member application UI missing policy versions. It **never** connects to the DB or reads values to stdout; diagnostics name configuration fields, not secret contents.
- `scripts/smoke-deployed-release.mjs` performs **GET-only** checks of live public pages, `/robots.txt`, API liveness/readiness, admin login redirect, unauthenticated staff API denial, hidden matrix route and (by default) held member registration. It does **not** submit contact/volunteer forms, create staff accounts, issue tokens or edit anything. HTTPS required for non-local origins.
- `scripts/verify-deployment.sh` brings the two configuration checks and live read-only smoke together as **`npm run verify:deployment`**, with three required environment variables, all paths provided outside Git. It will fail if a URL or config is missing. Root `npm run verify` remains for disposable development/MySQL only — **never run it against production**.
- Production NestJS listens only on `127.0.0.1` or `::1` and trusts `X-Forwarded-For` only from the loopback proxy. The provided `infra/nginx.nisvartha.example.conf` intentionally **overwrites** forwarded-for to `$remote_addr` rather than accepting spoofed lists. Compiled NestJS API regression tests verify that five bad requests from one forwarded IP throttle that client but not another.
- `scripts/smoke-backup.mjs` now generates an isolated synthetic WebP object plus an authoritative `cms_media` row, dumps the relevant MySQL tables, restores them in a separate database alongside a copied private media tree, and verifies row key + SHA-256 against bytes. This proves **synthetic paired restore mechanics**, not real encrypted offsite backup or a concurrent production snapshot.

## Deployment posture for an approved Ubuntu/Nginx host

1. **External requirements (not supplied by source):** verified Foundation content/brand/contact details, publishable privacy/terms/retention policy, owner acceptance, actual host and domain, DNS/TLS, authorized staff identities, operations/security contact and lawful financial decision. No source test can invent or sign these.
2. **Runtime host:** Node.js 22, MySQL 8.4 (dedicated least-privilege account), ClamAV, Nginx, suitable persistent private media storage, firewall and encrypted backups. The existing `infra/compose.verify.yml` is **test-only**; never deploy that with default CI passwords to the public network.
3. **Front-end build variables:** inject `NODE_ENV=production`, `NEXT_PUBLIC_SITE_URL=https://APPROVED_DOMAIN`, `NEXT_PUBLIC_API_URL` matching that HTTPS site origin, `API_INTERNAL_URL=http://127.0.0.1:3100`, and explicitly configured feature gates **before** building Next.js. `NEXT_PUBLIC_*` values are compiled into client assets; runtime-only changes do not rewrite an already built bundle.
4. **Backend runtime variables:** `NODE_ENV=production`, `HOST=127.0.0.1`, `PORT=3100`, `DATABASE_URL` pointing at the dedicated **non-CI** MySQL account, `PUBLIC_WEB_ORIGIN=https://APPROVED_DOMAIN`, `MEDIA_STORAGE_ROOT=/srv/nisvartha/shared/media` (private persistent path), `MEDIA_SCANNER_BIN=clamscan`, and explicit app flags. Keep private credential files **out of the repository**; use restricted file permissions and system service identities.
5. **Feature gate defaults:** `PUBLIC_CONTENT_APPROVED=false`, `CMS_PUBLIC_CONTENT_ENABLED=false`, `NEXT_PUBLIC_FORMS_ENABLED=false`, `NEXT_PUBLIC_PRIVACY_APPROVED=false`, `FORM_SUBMISSIONS_ENABLED=false`, `PRIVACY_NOTICE_APPROVED=false`, `MEMBER_PORTAL_ENABLED=false`, `MEMBER_APPLICATIONS_ENABLED=false`, `MEMBER_STAFF_REGISTRATION_ENABLED=false`, `MEMBER_RECOVERY_ENABLED=false`. Enable **only** a specifically authorized feature after its terms/privacy/content and operations checks; never presume the E-PIN candidate policy is a payment system.
6. **Proxy:** adapt `infra/nginx.nisvartha.example.conf` only after providing a real FQDN and trusted certificate; `nginx -t`, TLS, firewall and actual browser/UAT smoke must be validated on the intended host. Route `/api/v1/` to `http://127.0.0.1:3100` (path retained) and the rest to Next.js loopback `3102`. Start compiled Next.js with `-H 127.0.0.1 -p 3102`. Never expose raw NestJS or Next ports publicly. Limit upload size and preserve `X-Forwarded-Proto` for secure browser requests.
7. **Data protection:** take a consistent database snapshot **paired with private media** (quiesce writes or use a proven consistency protocol), encrypt and access-control backup artifacts, store off-host, retain according to the approved policy and perform an **isolated full restore** including image checksums before accepting submissions/gallery uploads.
8. **Security/operations:** verified admin bootstrap on trusted host, TLS and approved HSTS, least-privilege database/media accounts, scanner health, logging/rotation without tokens/PII, monitoring/alerting, backups and documented rollback. Manually test keyboard/screen-reader, mobile/desktop and real approved content. No production secrets should be committed or pasted into tickets.

## One-command non-mutating release-host validation

Use the **same real configuration files** that the supervised backend/frontend processes use (Node 22 supports `--env-file`). Supply these variables to a trusted operator shell, **not a shared chat or repository**:

```bash
export NISVARTHA_API_ENV_FILE=/etc/nisvartha/api.env
export NISVARTHA_WEB_ENV_FILE=/etc/nisvartha/web.env
export SMOKE_WEB_ORIGIN=https://APPROVED_DOMAIN
npm run verify:deployment
```

This command checks both actual env files and the deployed HTTPS origin, refuses missing settings and prints no secrets. It assumes the frontend was **built using these same reviewed public env variables**. The smoke checks the default disabled member portal and global noindex; once owner approvals legitimately enable these, explicitly set `SMOKE_EXPECT_MEMBER_DISABLED=false` and/or `SMOKE_EXPECT_NO_INDEX=false` for the correct release profile. Those switches only change **smoke expectations**, not app flags, permission, legal approval or deploy behavior.

**Before a deployment exists:** test the two env files separately (no live smoke claim) with `node --env-file=/etc/nisvartha/api.env scripts/release-preflight.mjs api` and `node --env-file=/etc/nisvartha/web.env scripts/release-preflight.mjs web`. On the isolated development machine, root `npm run verify` covers migrations/builds/integration/browser tests.


## Compiled full-stack artifact: real migration and Admin provisioning path

The full-stack CI archive now contains: **api/** (compiled NestJS, production Node modules, first-admin bootstrap script), **web/** (compiled Next.js standalone server) and **ops/** (exact Prisma schema + append-only migrations + backend lockfiles + explicit migration runner). This is not an auto-deploy: a deployment authority must approve the release and target server.

1. Build the artifact with the **actual approved domain** and signed feature flags. Next.js `NEXT_PUBLIC_*` inputs are compiled into the asset; the CI default-off bundle's hostname/flags are not silently rewritten by setting runtime variables. Confirm archive SHA-256 before extraction. Do not use the public-preview-only archive for member or Admin workflows.
2. On an approved Ubuntu Node 22 host, provision a **dedicated non-CI MySQL 8.4 database/account**, protected `/etc/nisvartha/api.env` and `web.env` outside the release, persistent private media root, ClamAV, HTTPS reverse proxy, host firewall, backups and operator access. Keep secrets out of Git and command-line arguments.
3. Before migration, take and **verify** a consistent backup of both the authoritative DB and private media. Record its reference and obtain release/migration approval. The packaged migration runner refuses missing approvals, invalid DB configuration, missing migration files and a mismatched commit. It runs only on explicit invocation, never on app startup.
4. After independently matching the archive's `RELEASE_INFO.json` SHA with the approved PR, invoke the extracted `ops/deploy-migrations.mjs` under Node 22 using `--env-file=/etc/nisvartha/api.env`, setting `NISVARTHA_RELEASE_APPROVED_SHA`, `NISVARTHA_MIGRATION_APPROVED=true` and `NISVARTHA_MIGRATION_BACKUP_REF` in the operator's controlled environment. The script executes `npm ci` from the pinned lockfile in **ops/** and `prisma migrate deploy`; an npm registry connection (or trusted pre-populated package cache) is required. No migration operation occurs if the validation gate fails.
5. Bootstrap the **first** real administrator exactly once with `node --env-file=/etc/nisvartha/api.env /srv/nisvartha/current/api/scripts/bootstrap-admin.mjs` and verified `NISVARTHA_BOOTSTRAP_EMAIL`/`NISVARTHA_BOOTSTRAP_NAME`; supply the initial password on protected stdin. The existing bootstrap refuses a second initialization and never prints a password.
6. Start only the compiled API (`api/dist/main.js`) and Next server (`web/server.js`) on loopback using the reviewed runtime config; configure a supervised service manager and Nginx only after infrastructure authorization. Verify API live/ready, forms/member/Admin routes with the **approved** flags and real database, TLS, actual backup restore, operator RBAC, and human UAT. Keep financial/payout routes disabled pending their separate approvals.

No production migration, live domain, staff bootstrap, financial authorization or deployment is asserted by this source change. The release archive still needs authorized operator execution and client-provided legal/content/hosting inputs.

## Release artifact and production feature-flag parity

A compiled Next.js standalone application retains its build-time feature flags. The release now records every non-secret website feature flag and the public origin in `RELEASE_INFO.json`. The packaged `ops/release-profile.mjs` refuses to validate a running installation if its API/web environment files disagree with those compiled flags or if the proxy API origin/port do not match. This prevents an all-disabled bundle from being represented as a working enabled Member/registration release.

The default CI artifact remains `FULL_STACK_DEFAULT_OFF_CANDIDATE` for safe review. To hand over member-enabled nonfinancial functionality, rebuild the **exact reviewed commit** under the approved production origin and approved membership/terms/privacy flags; do not reuse an all-off bundle by changing only systemd environment variables. `npm run verify:deployment` now reads the build manifest from `NISVARTHA_RELEASE_MANIFEST` (default: `/srv/nisvartha/current/RELEASE_INFO.json`) and checks API, website and release metadata before making read-only HTTP requests. This verification does not authorize payment, matrix or commission features.

## Supervised production runtime units (Ubuntu systemd)

The full-stack release tarball includes `ops/systemd/nisvartha-api.service` and `ops/systemd/nisvartha-web.service`. They start the **compiled** API and Next.js server from `/srv/nisvartha/current` as an unprivileged `nisvartha` account, use restricted external env files at `/etc/nisvartha/`, restart failed services and bind the website to loopback only. The API unit grants access only to the persistent private media directory under an otherwise read-only filesystem. No Docker verification compose file, CI password, fake identity or production secret is embedded in either unit.

On an authorized, configured host, separately verify `/usr/bin/node` is Node 22, provision the `nisvartha` service user and real persistent media directory, install the units with root ownership under `/etc/systemd/system/`, run `systemctl daemon-reload`, and enable/restart the services **only after** the packaged migration runner succeeded and backups, Nginx/TLS, environment parity and operator approval are checked. Keep the deployed release directory root-owned/read-only. Next.js may need a deliberately writable, isolated cache location; validate cache/image behavior under the service account during staging acceptance. A unit file in the artifact is not evidence of service installation or live health.

## Still outstanding before production acceptance

- No approved domain/host access, full production staging build/deployment, actual TLS readiness, official content/data-controller/retention sign-off, live staff identities, or human UAT evidence has been supplied to this execution.
- Production backup schedule, encrypted off-host storage, paired real-asset restore/rollback, operational owner and monitoring must be configured and evidenced on the chosen server.
- Paid registration, real E-PIN issuance/redemption, 1:3 referral/matrix payouts and wallets remain outside the nonfinancial SRS release and cannot be activated by this checklist. Only one proposed registration payment (no installments) is in the stakeholder clarification; independent signed legal/financial clearance is still absent.

**Honest acceptance state:** code-based release safety checks can be green on the repo without proving the external production dependencies above. Keep the consolidated PR draft/unmerged until explicit authorization and verified source/UAT acceptance.

## Single active ADMIN application contract (2026-11-06)

The Foundation's business decision is **one ADMIN account**, not multiple administrator operators. The initial ADMIN is provisioned once with the existing protected `backend/scripts/bootstrap-admin.mjs`. Staff creation has been removed from NestJS and from the website; the BFF also denies staff creation. No second-ADMIN approver is required for approved administrative tasks.

For legacy databases containing more than one already-created administrator, the authenticated primary operator can disable extra active accounts. Retirement revokes all their sessions, records a MySQL audit entry and cannot be reversed through the API or UI. The current administrator cannot disable themself or disable the last active account. The application does not delete or silently choose among existing legacy accounts; resolve them explicitly with the Foundation before production acceptance.

The existing schema can technically contain historical inactive staff rows (for audit foreign keys), so this is an **application-level single-active-ADMIN contract** for new deployments, not a declaration that old databases are already clean. CI verifies exactly one active account after bootstrap and after retirement, and that POST creation and reactivation fail.

No joining fees, commission liabilities, rebirth payments or wallet operations are enabled by this access control change.
