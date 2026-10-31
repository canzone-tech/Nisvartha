# Nisvartha Foundation

Official repository for the Nisvartha Foundation website. Requirements baseline: `Nisvartha_Foundation_SRS_v1.0` (stakeholder-review draft; business and legal approvals remain separate).

## Delivery scope

- **Phase 1 — Public website first:** responsive Foundation information, activities, Go Green, projects, volunteer/contact enquiries with validated, persistent submissions, privacy/consent, accessibility, SEO and operational security.
- **Phase 2 — CMS and administration:** editorial workflows, content publishing, galleries, news/events, role-based access, audit trails and enquiry management. Introduce only when scoped; Phase 1 enquiries still need an authorized handling process.
- **Later / separately approved:** member portal and other business workflows.

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

This README establishes repository boundaries only; no application code, database schema or deployment is initialized yet.
