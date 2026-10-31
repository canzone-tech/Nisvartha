# Phase 2 — Nisvartha staff CMS operation and release gates

Status: **development on `dev/phase2-cms-admin`; production not authorized**. Phase 1 remains on `dev/phase1-public-website`. This guide does not authorize financial/member workflows.

## What was implemented

- Dedicated staff account authentication (Argon2id), revocable SHA-256-hashed opaque session tokens, role check on every endpoint, login throttling, account lockouts, role/status revocation and transactionally persisted audit.
- Roles: `ADMIN`, `EDITOR`, `APPROVER`, `AUDITOR`. Editing/drafting requires editor/admin. Publishing needs approver/admin **different from original author**. Auditor can read content/audit only, not mutate.
- Content is stored in MySQL with revision history. Draft, submit, approve/reject and archive are distinct workflows; previous approved revision stays public while replacement draft is in review.
- Controlled case processing for contact and volunteer enquiries, assignment, internal notes, statuses, legal hold and admin-only audited export. Legal retention is fail-closed until approved configuration.
- Public Content API displays only approved, unarchived content. Next.js server reads it only when `CMS_PUBLIC_CONTENT_ENABLED=true`.
- FR-022 event scheduling stores start/end time, IANA timezone, venue or HTTPS meeting link, optional HTTPS registration link and status in the **approved revision snapshot**. An editor cannot silently change live event dates/status. The browser renders only approved data; cancelling is a reviewed revision. On-site attendee signup/payment is not implemented.\n- CMS image/gallery upload and object storage are still **unimplemented**. Do not claim that media upload, rights checks, consent workflows or malware scanning are complete.
- Financial E-PIN/member registration/genealogy/1:3 matrix/payouts are not CMS functions and have **no approved implementation**.

## First administrator bootstrap

On an **authorized local/staging operator host** with verified schema and staff DB access, securely configure `NISVARTHA_BOOTSTRAP_EMAIL` and `NISVARTHA_BOOTSTRAP_NAME` then supply a randomly generated, unique, 14+ character password via **trusted stdin** to `npm --prefix backend run staff:bootstrap`. Never place the password in Git files, command arguments, CI logs or chat. Bootstrap succeeds **only while zero staff accounts exist**; later accounts require a logged-in ADMIN.

No bootstrap credentials were created as part of development. The first login occurs at `/admin/login`. Admin UI is accessible only with a signed-in, active staff role.

## Activation controls

- `API_INTERNAL_URL`: trusted internal NestJS API URL for server-side Next.js calls.
- `CMS_PUBLIC_CONTENT_ENABLED`: default `false`, enable only when content review, legal policies and staging tests are signed off.
- `PUBLIC_CONTENT_APPROVED`, `NEXT_PUBLIC_FORMS_ENABLED`, `NEXT_PUBLIC_PRIVACY_APPROVED`, `FORM_SUBMISSIONS_ENABLED`, `PRIVACY_NOTICE_APPROVED` and `PRIVACY_NOTICE_VERSION` continue to gate public web indexing, personal-data submissions and consent.
- `ENQUIRY_RETENTION_APPROVED`: default `false`; even when `true`, requires an approved `ENQUIRY_RETENTION_DAYS` integer (30–3650). Retention anonymizes eligible records in batches of at most 50 and is blocked by legal holds. No automatic retention job is scheduled.
- Data exports contain personal data and are subject to the Foundation's approved data-handling, encryption and access policies. Case reads and exports produce audit records.

## Required verification

`npm run verify` is the repository-root isolated local/CI-equivalent test entry point. It requires Node 22, npm, Docker Compose and a dedicated local test environment; it spins up disposable MySQL 8.4, runs append-only migrations, compiled NestJS and Next.js startups, staff auth/CMS/case flow, backed-up restore smoke and browser tests. **Do not execute it on a production server.**

Before merge/deploy, ensure **both API CI and Web CI green on the exact same SHA**, review migration 0002 and 0003 against staging backup, perform manual keyboard/screen reader/desktop/mobile tests, recovery/restore and official content acceptance. Do not deploy before an explicit user instruction.

## Reuse safety

See [MegaMitra reuse boundary](MEGAMITRA-REUSE-BOUNDARY.md). MegaMitra's E-PIN registration assumes season payments and its genealogy uses left/right binary slots A-D. Nisvartha's flyer describes fixed 1:3; changing 4 to 3 is not safe. Financial plan modules are separately gated.
