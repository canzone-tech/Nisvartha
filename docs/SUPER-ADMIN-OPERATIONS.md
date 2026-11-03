# Nisvartha SUPER_ADMIN security boundary (nonfinancial)

**Change:** Add `SUPER_ADMIN` to the authoritative `StaffRole` enum through append-only migration `0009_staff_super_admin_role`. No historical migration was edited. No paid E-PIN feature is enabled or implemented.

## Authority and role hierarchy

- `SUPER_ADMIN` inherits existing `ADMIN`-permitted API actions via `StaffGuard`; an ordinary `ADMIN` **never** inherits `SUPER_ADMIN` actions. The logged-in principal's actual role remains `SUPER_ADMIN` in audit and UI. Individual controllers may require `SUPER_ADMIN` explicitly for separately approved future operations.
- Ordinary staff-management API requests cannot create, grant, downgrade, disable or edit `SUPER_ADMIN`. Backend checks are authoritative; the frontend also hides action buttons on protected rows. Existing ADMIN/EDITOR/APPROVER/AUDITOR permissions remain.
- Role/status update uses `SELECT ... FOR UPDATE` on the authoritative staff row, checks for protected role **inside** the transaction, updates only permitted non-root staff, revokes all target sessions and writes a transactionally consistent CMS audit record.
- No automatic role migration or account elevation occurs when the new enum migration is deployed.

## First-account bootstrap only

A first SUPER_ADMIN account may be provisioned on a trusted **isolated, approved administrative host**, via the explicit `staff:bootstrap-super-admin` backend script using secure stdin for a 14–128 character password. It requires:

- `DATABASE_URL` pointing to the intended isolated target database (never synthetic CI credentials in other environments).
- `NISVARTHA_BOOTSTRAP_EMAIL` and `NISVARTHA_BOOTSTRAP_NAME`, for the first staff account only.
- `NISVARTHA_SUPER_ADMIN_BOOTSTRAP_CONFIRM=CREATE_FIRST_STAFF_SUPER_ADMIN` to block accidental invocation.
- `NISVARTHA_SUPER_ADMIN_SECURITY_APPROVAL_REF`: pre-existing security/operator approval register reference. The software validates its format and stores the reference in an audit event, **not the signature or legitimacy of the approval**.

The script refuses to run if even **one** staff account already exists. Its initial account creation and `BOOTSTRAP_SUPER_ADMIN` audit event are atomic under a SERIALIZABLE transaction. No bearer token or password is printed, placed into command-line arguments, logs or audit metadata.

**Existing installation:** where an ADMIN/other staff user already exists, the first-user script **will not** promote that account and the normal API cannot do so. A separately reviewed, signed and audited operator process is required; this PR does not silently make an existing verified ADMIN become SUPER_ADMIN.

Do not run migration verification, a bootstrap or any app source on the production runtime host. Follow the Foundation's staging/ops approval and documented recovery plan before real provisioning.

## CI and acceptance

- `scripts/smoke-super-admin-rbac.mjs` boots a compiled NestJS API against isolated MySQL 8.4, proves explicit first-user bootstrap, refuses missing approvals/confirmation and duplicate bootstrap, and exercises login, ADMIN inheritance, ordinary ADMIN denial, concurrent forbidden elevation, root role protection, authorized ordinary staff changes, session revocation and audit.
- Root `npm run verify` runs this script; API CI runs the same regression on synthetic users and database.
- Web CI typechecks SUPER_ADMIN's staff dashboard and keeps staff-management actions disabled on root accounts.
- `scripts/check-scope.mjs` and `scripts/check-paid-epin-hold.mjs` allow **only** append-only role migration `0009_staff_super_admin_role` beyond existing migrations and still block paid E-PIN/financial schema, routes, member writes and compensation.
- Report exact-head CI and an independent development-host local verification result before merge. No deployment implied by green CI.

## Still outside scope

E-PIN batch generation, PIN allocation, payment order, settlement, paid member activation, 1:3 matrix, referral commissions, wallets and payouts remain unimplemented and on legal/financial HOLD. Staff verification and SUPER_ADMIN login do **not** prove financial settlement or grant business/legal permission to activate paid joining.
