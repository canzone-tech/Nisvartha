# E-PIN policy-validation history (MEGA-first, issuance still held)

Source: `canzone-tech/megamitra`, `dev/local-foundation` has owner E-PIN operations and operator audit. Nisvartha already has a protected `POST /api/v1/staff/epin-batches/validate` that writes a `cms_audit` record on every successful **policy check**. This change reuses the existing authoritative audit records; no new table, store, business configuration, migration or MEGA data copy.

## Scope

- `GET /api/v1/staff/epin-batches/history` is protected with the existing `StaffGuard` and `ADMIN/SUPER_ADMIN` roles.
- Fetches at most 25 successful `EPIN_BATCH_POLICY_VALIDATED` / `STAFF_PREVIEW` audit rows **for the authenticated actor only**, ordered newest-first by event timestamp and id.
- Selects only `id`, `action`, `summary`, and `createdAt`; never returns `actorId`, opaque credentials, hashes, tokens, identity evidence, money, or member data.
- Existing Next.js staff BFF explicitly allows the new GET route; staff HttpOnly session controls remain unchanged. The existing Admin E-PIN preview panel shows personal history and allows a manual refresh, and refreshes after a successful validation.
- Existing all-action `/cms/audit` panel remains unchanged, available to ADMIN/AUDITOR as before. This narrower personal E-PIN history is not a replacement for central security audit or retention.

## Verification and boundaries

`scripts/smoke-super-admin-rbac.mjs` tests real isolated MySQL for missing authorization, Editor denial, empty history, cross-operator isolation, strict four-field response, exactly one history event per valid preview, invalid-preview denial, and an enforced 25-row cap. `scripts/smoke-web.mjs` checks anonymous BFF denial and unavailable issuance routes; the financial HOLD gate recognizes exactly `GET history` and `POST validate` and rejects other E-PIN endpoint additions.

**Status remains HOLD:** There is no paid E-PIN issuance, E-PIN purchase, assignment, redemption, payment/settlement verification, member activation, 1:3 genealogy, commission, wallet, payout or Lucky Draw. SRS v1.0 FR-033/034 signed legal/financial review remains prerequisite to any such development and deployment. Both GitHub CI workflows must pass at exact branch HEAD; local `npm run verify` still requires execution on the developer environment. No automatic merge or deployment.
