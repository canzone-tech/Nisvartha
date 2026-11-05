# Versioned scenario policy review — UAT only

This step evolves PR #27's browser-only matrix preview into **database-backed, immutable internal review records**. It does NOT approve or activate a compensation plan, issue real rebirth IDs, post referral earnings, or place actual members in a forced matrix.

## Admin and independent reviewer workflow
The dedicated \`/admin/matrix\` page now has two separate concerns:

1. The Admin uses the current 1:3/5-level fake placement simulator, sets entrants and rebirth-candidate counts, and selects **Save new draft version**. This stores a new immutable snapshot in the disposable MySQL \`sandbox_policy_revisions\` table, with a unique request UUID for safe retries and a monotonically allocated version number. No "update policy" action exists.
2. The author selects **Submit version for independent review**. A separate APPROVER logs in on the same \`/admin/matrix\` route, reads the most recent 50 immutable scenario versions, compares them with the previous revision, enters a review note and chooses **Mark reviewed (simulation only)** or **Reject scenario**. The author cannot review their own version. A reviewed scenario remains *non-operational*.

Status transitions: \`DRAFT → SUBMITTED → REVIEWED | REJECTED\`, with one-way conditional updates. No \`ACTIVE\`, \`effectiveAt\`, publisher, activation or payout operation exists. Current "Save new draft version" never mutates a previous version.

This uses the existing NestJS staff guards and Next.js same-origin staff BFF:
\`GET /api/v1/staff/matrix-preview/policies\` (Admin/Super Admin/Approver);
\`POST /api/v1/staff/matrix-preview/policies\` (Admin);
\`POST /api/v1/staff/matrix-preview/policies/:id/submit\` (owning Admin);
\`POST /api/v1/staff/matrix-preview/policies/:id/review\` (independent Approver/Super Admin).
Every API additionally refuses access unless \`NISVARTHA_UAT_PLAN=synthetic\` **and** \`DATABASE_URL\` points to disposable local \`nisvartha_ci\` in non-production. All authenticated review operations write CMS audit history in the same MySQL transaction.

## Verification
Append-only Prisma migration \`0013_sandbox_policy_revisions\`; no edits to existing migrations. \`npm run verify\` and API CI execute real-MySQL tests for replay key collisions, immutable snapshots, author/reviewer separation, invalid status transitions, concurrent unique keys, audit counts, and production DB rejection. The compiled local-UAT launcher also exercises the form BFF, Admin/Approver cookies, save/submit/review lifecycle and lack of member-side mutation. The previous client source HTML remains byte-identical.

**Note:** Interactive local UAT uses a disposable Docker Compose database; \`Ctrl+C\` tears down the project and test volume. The snapshots persist inside that UAT session and are reset on the next launch. There is no operational persistent production policy in this feature.

## Still not specified by signed financial rules
Rebirth parent/spillover placement, actual money source and tax/accounting, cancellation windows, re-entry lifecycle, and lawful sale-linked compensation rules. Review status is not authority to credit a wallet, promise returns or create financial entitlements.
