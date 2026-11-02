# Nisvartha — nonfinancial membership review backlog pagination

**Source:** Nisvartha SRS v1.0 FR-029–034 and existing staff membership application service, plus MEGA-first reuse boundaries. This change addresses the already-implemented reviewer queue's silent `take:100` truncation; it does **not** authorize membership fees, placement, activation E-PINs or compensation.

## Existing behavior and compatibility

- The existing `GET /api/v1/cms/membership/applications` returns an array of at most 100 newest applications. It is kept unchanged for existing consumers.
- Roles remain `ADMIN`/`APPROVER` (with existing `SUPER_ADMIN` inheritance); backend `StaffGuard` continues to deny unauthorized access.
- Review, approve, reject, suspend, session revocation and audit behavior remain unchanged.

## New read-only review queue

- `GET /api/v1/cms/membership/applications/page?status=SUBMITTED&limit=25&cursor=<uuid>` returns `{items,nextCursor}`. Optional status values: `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `SUSPENDED`, `WITHDRAWN`. Omit status for all. Default limit 25, allowed 1–50; cursor is an existing UUIDv4 application id.
- Stable keyset order `createdAt DESC, id DESC` handles tied timestamps without duplicate/skipped rows; predicate is `createdAt < cursor.createdAt OR (createdAt=cursor.createdAt AND id < cursor.id)`. Cursor must exist and match the chosen status, else 400. Requests always operate on current authoritative DB state; status changes during pagination may alter the resulting pages, so the API does not claim snapshot isolation.
- Uses existing `membership_applications` table and its `(status,createdAt)` index; no migration or external state store.
- Existing Next.js staff BFF allowlists the new `/applications/page` path and forwards only `status/cursor/limit`, rejecting duplicates and unexpected keys. Backend DTO independently validates all fields.
- Admin review panel now filters status, loads 25 at a time, preserves existing review/decision actions and ignores stale async responses when filters change.

## Verification

- `scripts/smoke-member-review-pagination.mjs` runs compiled NestJS against isolated MySQL with 127 synthetic applications sharing one creation timestamp. Checks complete traversal, strict stable order, no duplicates, all status filters, unknown/invalid/cross-status cursor rejection, maximum page size, anonymous and EDITOR denial, original endpoint compatibility and no state mutation.
- `scripts/smoke-member-web.mjs` checks compiled Next.js review BFF query forwarding, anonymous denial and duplicate/unrecognized parameter rejection with actual staff cookie authentication.
- API CI and root `npm run verify` both include the new MySQL test. Existing frontend production build, browser UAT and paid E-PIN HOLD scope checks remain required.

**Financial boundary:** Review approval remains nonfinancial. No issuance, payments, referrals, genealogy, 1:3 placement, Lucky Draw, wallet, rewards or payout implementation is added. Live financial scope remains held under SRS FR-033/034 pending signed independent financial/legal review. Branch is draft-only and must not be merged/deployed automatically.
