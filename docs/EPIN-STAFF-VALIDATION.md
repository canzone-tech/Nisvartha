# E-PIN batch validation — staff-only implementation boundary

**MEGA source contract:** `megamitra/dev/local-foundation`, `OwnerPortalService.generateEpins()` and `GenerateEpinsDto`: source supports ACTIVATION/INSTALLMENT, but Nisvartha supports only registration-time ACTIVATION, quantity 1–500, expiry, privileged actor and audit. In MEGA these are coupled to active commercial season, payment values, inventory and paid enrollment.

**Nisvartha status:** Draft child of `dev/phase3-mega-epin-batch-core`. Existing signed SRS v1.0 FR-033/034 holds paid E-PIN issuance, payments, 1:3 referral/matrix compensation, wallets and payouts pending approved financial/legal scope. The stakeholder confirmed ADMIN and SUPER_ADMIN as designated issuers; the backend does not equate staff verification with payment settlement.

## Delivered API and dashboard

- `POST /api/v1/staff/epin-batches/validate` takes JSON `{ "quantity": 5, "pinType": "ACTIVATION", "expiresAt": "2027-01-31T23:59:00+05:30" }`. An omitted `pinType` defaults to ACTIVATION (internal code for one-time registration); explicit null, `INSTALLMENT` or any other type is invalid. Quantity must be integer 1–500, and expiry must be a valid timezone-bearing future timestamp.
- **StaffGuard** and explicit `@StaffRoles(ADMIN,SUPER_ADMIN)` enforce current ACTIVE authenticated session and roles server-side; anonymous, EDITOR, APPROVER, AUDITOR and members cannot access it. POST requests are rate-limited.
- Successful response contains **only** normalized quantity, PIN type, UTC expiry and `{ "issuanceStatus": "HOLD", "canIssue": false, "generated": 0 }`. No candidate raw codes, hashes, IDs, inventory, sales records or financial state are created.
- Each successful authorized validation writes one `cms_audit` entry with the staff actor and safe batch metadata, not secret material. Invalid validation requests do not write issuance audit entries.
- The staff preview displays **one-time registration E-PIN** only; inherited installment selection was removed. Staff select expiry through a native calendar/date-time input in their browser's local time zone. The client converts the chosen valid wall-clock time to an unambiguous UTC ISO 8601 timestamp (`Z`) before sending it to the existing API, and displays the submitted UTC value. Invalid/nonexistent or DST-ambiguous local times are rejected; backend expiry validation remains authoritative.
- Next.js staff BFF explicitly allowlists the route with existing same-origin POST and HttpOnly staff cookie protections; `/admin/epin` displays a non-issuing policy preview only for ADMIN/SUPER_ADMIN. There is **no generator UI** and no transaction to call.
- Reused the same pure `validateEpinBatchRequest()` contract inside `prepareEpinBatch()` so future authorized issuance can share canonical validation without duplicated domain decisions. Existing 256-bit credential format remains unchanged.

## Regression/acceptance

- `scripts/smoke-super-admin-rbac.mjs` now tests compiled NestJS on isolated MySQL for anonymous/EDITOR denial, ADMIN/SUPER_ADMIN approval, invalid batch inputs, hard HOLD response, no bearer disclosure, exactly-once successful preview audit and zero issuance.
- `scripts/test-epin-batch.mjs` checks validation output has no secret/id/status, correct type and dates, and preserves all prior candidate-generation tests.
- `scripts/check-paid-epin-hold.mjs` makes HTTP-layer issuance or calling secret generation fail the SRS gate.
- No schema, migration, applied DB table, MEGA files, reward policy, Lucky Draw, binary placement or paid member activation changed.
- CI and local `npm run verify` include relevant gates; exact-head API/Web CI must pass before review/merge. No production rollout is part of this branch.

### Remaining real-generation dependencies

Approved lawful commercial offering, settlement and proof-of-payment authority, signed source-of-truth and accounting/refund policy, delegated issuer permissions, atomic issuance with stable idempotency keys and audit, encrypted or one-time-only delivery, and transactional one-use redemption. These have deliberately **not** been implemented or enabled by this PR. An operator's policy preview is not an issued PIN.
