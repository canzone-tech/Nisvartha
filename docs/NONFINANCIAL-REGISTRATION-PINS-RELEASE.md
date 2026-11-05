# No-fee Admin-issued registration access PIN contract

Only ADMIN creates no-fee, single-use member application PINs. These codes cannot be purchased and do not settle payments, approve memberships, reward referrals, or activate matrix/wallet/payout logic. The financial HOLD remains.

## Authoritative lifecycle

- Append-only migration 0015 creates registration_pin_batches and registration_pins, separate from synthetic UAT tables.
- ADMIN creates 1–50 high-entropy codes in an idempotent request. Hashes, encrypted recoverable PINs, and six-character suffixes are stored; full codes remain viewable to authenticated Admin with audited reads.
- ADMIN inventory offers bounded status filters and cursors without revealing secrets.
- Public or staff-assisted application consumes one available PIN atomically with member creation using a MySQL row lock and conditional update. A successful claim creates PENDING account and SUBMITTED application only, subject to Admin review.
- Audit records the issuing Admin and batch ID. No price, order, settlement, financial posting, commission or entitlement is created.

## Release gates

REGISTRATION_ACCESS_PIN_ENABLED is false by default. Enabling requires member portal, application submissions, approved membership terms/privacy versions and authorized operator review. It must never overlap the disposable synthetic PIN mode.

CI covers compiled API with real MySQL, Admin RBAC, transaction/replay/concurrency/expiry, compiled Next.js BFF, CSRF and live form rendering. Root npm run verify is the parity gate.

For disposable manual review only: NISVARTHA_UAT_PIN_FLOW=access npm run uat:local. Use only example.invalid fake applicants and temporary codes. It must never run on the production host.

The current website-only production preview intentionally blocks /admin, /member and /api. Full-stack production requires a reviewed compiled backend and frontend from the same SHA, a dedicated MySQL 8.4 database, approved terms/privacy, backup/restore, TLS and authorized migration/rollback. Never use test credentials or copy source code to the server.

## Admin PIN inventory visibility

Migration 0016 adds a nullable AES-256-GCM sealedCode to real and disposable UAT PIN rows. New full PINs remain visible in authenticated Admin inventory for Available/Used/Expired states; account redemption still uses the original purpose-bound one-way hash. Each full-code read is audited; no-store headers are enforced by backend and BFF. Legacy hash-only rows remain masked and cannot be retroactively unmasked.

The API must receive a protected, independently generated 32-byte base64url PIN_VAULT_KEY. Back up its exact bytes independently from MySQL and restrict access; losing the key or changing it without re-encryption makes encrypted PINs unreadable. CI/UAT generate separate disposable keys that MUST NOT be used in production. Never place the key in the frontend bundle, Git, command history or logs.
