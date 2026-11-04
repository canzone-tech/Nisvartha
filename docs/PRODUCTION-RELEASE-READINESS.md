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

## Still outstanding before production acceptance

- No approved domain/host access, full production staging build/deployment, actual TLS readiness, official content/data-controller/retention sign-off, live staff identities, or human UAT evidence has been supplied to this execution.
- Production backup schedule, encrypted off-host storage, paired real-asset restore/rollback, operational owner and monitoring must be configured and evidenced on the chosen server.
- Paid registration, real E-PIN issuance/redemption, 1:3 referral/matrix payouts and wallets remain outside the nonfinancial SRS release and cannot be activated by this checklist. Only one proposed registration payment (no installments) is in the stakeholder clarification; independent signed legal/financial clearance is still absent.

**Honest acceptance state:** code-based release safety checks can be green on the repo without proving the external production dependencies above. Keep the consolidated PR draft/unmerged until explicit authorization and verified source/UAT acceptance.
