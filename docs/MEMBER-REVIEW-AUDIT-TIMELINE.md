# Membership application audit timeline — nonfinancial

**Source-aligned scope:** Existing NestJS membership review and two authoritative MySQL audit stores in `canzone-tech/Nisvartha`. This is an extension of the existing staff review workflow (PR #12); no new datastore, migration, role model, status, or MEGA financial flow is introduced.

## Existing authoritative events

- `member_audit`: `ACCOUNT_REGISTERED` when a member applies and `APPLICATION_WITHDRAWN` on member withdrawal, both written inside their existing transactions.
- `cms_audit`: `MEMBER_APPLICATION_REVIEW`, `MEMBER_APPLICATION_APPROVED`, `MEMBER_APPLICATION_REJECTED`, `MEMBER_APPLICATION_SUSPENDED` with reviewer/staff actor and application reference, inside existing review transactions.
- Other member security events (sign-in, password reset, recovery) and unrelated CMS actions are deliberately excluded. Full logs remain authoritative; this feature is a **read-only, lifecycle-specific projection**, not an independent history source.

## Endpoint and user interface

`GET /api/v1/cms/membership/applications/:id/history` requires the existing `StaffGuard` and `ADMIN` or `APPROVER` authorization (including the existing `SUPER_ADMIN` inheritance). Invalid UUID is rejected; nonexistent application is 404.

Response shape: `{ applicationId, events, truncated }`. Each event has `id, action, actorId, actorKind, summary, createdAt`. Both audit sources are read with explicitly selected safe fields; registration/withdrawal summaries are fixed safe descriptions and staff summaries are already non-sensitive audit text. No password, session, recovery bearer, financial data, personal identity evidence, or private decision reason is returned. Events are sorted newest first by event timestamp with unique-id tie-break. Up to 50 latest lifecycle events are returned with explicit `truncated` indicator, using bounded reads. Member-authenticated users cannot access the staff endpoint.

The existing Next.js staff BFF allowlists only the additional read-only `history` route. The existing Admin application list adds an on-demand **Review history** action per application, with loading/error/close states and stale-response suppression. Review and decision operations remain unchanged.

## Verification / shipping requirements

Existing `scripts/smoke-members.mjs` exercises the compiled API on real isolated MySQL: submitted → under review → approved → suspended timeline, decision reason non-disclosure, exclusion of password audit, and a distinct application's registration → withdrawn timeline without cross-app leakage. `scripts/smoke-member-review-pagination.mjs` asserts anonymous/EDITOR history denial. `scripts/smoke-member-web.mjs` validates the authenticated compiled Next.js BFF timeline and missing/invalid locator handling. All run in API CI and root `npm run verify`.

**SRS financial HOLD still applies:** no paid E-PIN issuance/redemption, payment, member financial activation, compensation, 1:3 matrix, Lucky Draw, wallet or payouts. This PR is draft only, not merged or deployed. Actual production handoff requires exact-head CI, local Docker-backed `npm run verify`, approvals and final review.
