# Nisvartha Foundation

Official repository for the Nisvartha Foundation website. Requirements baseline: `Nisvartha_Foundation_SRS_v1.0` (stakeholder-review draft; business and legal approvals remain separate).

## Delivery scope

- **Phase 1 — Public website first:** responsive Foundation information, activities, Go Green, projects, volunteer/contact enquiries with validated, persistent submissions, privacy/consent, accessibility, SEO and operational security.
- **Phase 2 — CMS and administration:** editorial workflows, content publishing, galleries, news/events, role-based access, audit trails and enquiry management. Introduce only when scoped; Phase 1 enquiries still need an authorized handling process.
- **Later / separately approved:** member portal and other business workflows.

## Self-hosted media storage
Images for Phase 2 are stored on the **same Nisvartha server**, in a private, persistent local directory configured by `MEDIA_STORAGE_ROOT` (for example `/srv/nisvartha/shared/media`). No S3, cloud bucket or public web-directory is used. MySQL holds media metadata/approval; the filesystem holds the actual bytes, both must be backed up together. Original uploads are staged privately, scanned with local ClamAV (required in production), re-encoded to WebP without EXIF, and served only after independent staff approval. See [local-media operations](docs/LOCAL-MEDIA-OPERATIONS.md).

## Architecture boundaries

- Next.js App Router, React, TypeScript for the public website.
- NestJS, TypeScript, REST API under `/api/v1`.
- MySQL 8.4 as authoritative database, Prisma ORM.
- Design tokens for brand colors, typography and component appearance. Color-theme changes should not require database migrations.
- Create only tables and migrations required by approved functionality. Never add speculative schema. Once applied, migrations are immutable; use append-only changes.
- Keep repositories, databases, secrets and deployments separate from MegaMitra/MegaGoldenClub. Reuse selected, reviewed technical patterns rather than importing its domain model.

## Proposed Auto Pool plan — NOT APPROVED FOR IMPLEMENTATION

The supplied Nisvartha flyer describes a **fixed 1:3 matrix, level-wise, with five levels**. It is **not** MegaMitra's binary left/right structure: no binary legs, binary pairing, pair-volume or carry-forward logic applies.

The flyer is unverified stakeholder input, not proof of legal compliance or financial feasibility. Until written legal clearance, approved business rules, finance reconciliation and separate implementation authorization, **do not** implement or enable matrix placement, fee collection, referral/level commissions, rebirth IDs, wallets, or payouts. Do not publish income promises or imply guaranteed returns.

## Engineering workflow

- `main` is the baseline/integration branch; implement changes on reviewed feature branches.
- Validate requirements against source SRS and real code before copying functionality.
- Add tests and CI; keep a root `npm run verify` that checks relevant lint, types, tests, builds, compiled startup, readiness and route smoke once the application exists.
- Protect secrets, require review and a green verification gate before merge; deployments require independent approval.

## Current Phase 1 development status

This feature branch contains a Next.js public website scaffold, NestJS contact/volunteer endpoints, a single Prisma enquiry migration, and CI smoke tests. **This is not approved for production launch.**

- All unverified public content remains review-pending and search-indexing disabled by default.
- Form UI requires both `NEXT_PUBLIC_FORMS_ENABLED=true` and `NEXT_PUBLIC_PRIVACY_APPROVED=true` in an authorized frontend build; the API independently enforces its server-side privacy gate.
- API submissions additionally require `FORM_SUBMISSIONS_ENABLED=true`, `PRIVACY_NOTICE_APPROVED=true`, and a non-empty `PRIVACY_NOTICE_VERSION`. The deployed privacy notice, retention schedule and data-controller contact must be approved before activating either flag.
- Enquiry retries use a client-generated UUID and persist a unique reference. No financial or matrix functionality is implemented.
- A minimal read-only operator CLI now exists for P0 enquiry retrieval. It requires a separate operator database connection; see [Phase 1 operations](docs/PHASE1-OPERATIONS.md). Full authenticated staff workflows and audit remain Phase 2.
- Phase 1 launch still requires approved copy/assets, privacy/terms, a verified staff access process, deployment hardening, backup/restore evidence and visual/browser UAT.
- Run root `npm run verify` on a development/verification host with Node 22, npm and Docker Compose; it uses an **isolated synthetic MySQL 8.4** service on loopback port 33306. Never run it on a production runtime host.
- Exact dependency trees are committed in `backend/package-lock.json` and `frontend/package-lock.json`; CI and local verification use `npm ci`.
- Web CI includes real Chromium mobile/desktop route, navigation and overflow tests and preserves browser screenshots for review. See [SRS acceptance traceability](docs/SRS-TRACEABILITY.md).

No production database has been migrated and no service has been deployed by these commits.

