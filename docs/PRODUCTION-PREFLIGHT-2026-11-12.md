# NISVARTHA production readiness — non-mutating checkpoint (12 November 2026)

**Purpose:** prepare the existing Nisvartha production host for a separately authorized compiled-only release. **Not an order to deploy or migrate.** Keep SRS v1.0, main, authoritative MySQL data, Apache, systemd, Node 24 and the old preview process unchanged during this audit.

## Source-confirmed release posture
- Review PR #44 targets `feat/versioned-matrix-sandbox-policy-2026-11-05`; it is still draft and cumulative. The production deployment target and review approval must be explicitly settled before merging.
- Current approved member authentication: **unique referral code + password**, with email/mobile intentionally shared. Historic NULL referral codes can block old members' access. No automatic backfill.
- CI uses MySQL 8.4. Historical server operations notes state MySQL 8.0.46; technical compatibility is not demonstrated merely by a CI pass.
- Existing code has an exact-SHA compiled-only artifact, `ops/deploy-migrations.mjs`, rollback-capable Apache cutover, post-migration `ops/check-release-migrations.mjs`, isolated synthetic paired backup/restore and read-only deployed HTTP smoke.
- **New pre-migration audit** `ops/audit-production-readiness.mjs` does constant read-only SELECTs: migration checksum prefix, server MySQL version and aggregate member missing-code counts; rejects anomalies. It is separately invoked with selected release SHA. No MySQL write permission is required for the audit.

## Execution gates
1. **Read-only operator inventory (not yet executed on host):** verify the exact compiled push artifact checksum/manifest; confirm system Node 22 binary, target Apache vhost, current systemd units, old release/rollback target, private env-file permissions, persistence and MySQL instance. Run the single production audit command in `docs/COMPILED-ONLY-APACHE-RELEASE-2026-11-10.md`. Do not transmit credentials or individual member details.
2. **Member identity gate:** if `missingCodes>0`, require owner-reviewed remediation keyed by immutable member ID, collision-safe uniqueness and audited secure handoff; do not infer identity from shared email/mobile.
3. **Database compatibility gate:** if MySQL is 8.0.x, run a compatible version rehearsal using an isolated restore against the complete 0024→0038 migration chain. Do not mutate or upgrade the live DB to make a CI gate green.
4. **Backup and restore gate:** actual consistent authoritative MySQL snapshot plus private media directory under a quiesced/reliable capture protocol; encrypted/off-host, controlled access; verified isolated restore including migration ledger, member sample counts and media hashes. CI synthetic restore smoke does not establish production recoverability.
5. **Deployment authorization gate:** reviewer and owner approval of this cumulative branch/target, approved terms/privacy versions, intended release channel, legal/financial gate evidence, rollback strategy, maintenance window and operator sign-off. No default-branch merge by inference.
6. **Staged runtime/UAT gate:** only after previous gates, apply approved append-only migrations through existing explicit runner, stage compiled runtime with verified Node 22 and private env files, use existing launcher/Apache rollback and TLS checks, run read-only deployment smoke, then human member/Admin UAT. The nonfinancial `client-review` archive must not be misrepresented as financial acceptance.

## Current evidence / unknowns

| Gate | Evidence | Status |
|---|---|---|
| Review branch automated CI | Exact-commit Web/API/Local Parity/Compiled jobs | Verify again on latest head |
| Local developer verification | Owner reported `Nisvartha complete isolated local verification: PASS` | Reported, does not establish live parity |
| Production DB migration ledger | Not queried through accessible production connection | NOT VERIFIED |
| Legacy NULL member codes | No production aggregate read | NOT VERIFIED |
| MySQL host version/parity | Historical note 8.0.46, not live-confirmed | NOT VERIFIED |
| Real paired backup and off-host escrow | CI synthetic proof only | NOT VERIFIED |
| Isolated restore with real production data | No evidence available | NOT VERIFIED |
| Active host services, TLS/vhost, rollback | Source scripts exist; on-host execution not evidenced | NOT VERIFIED |
| Release and financial approval / on-host UAT | Separate human record required | NOT VERIFIED |

No production service or database operation was performed while preparing this checkpoint. Do not claim production readiness because the source test suite is green.

## Source-gated MySQL 8.0.46 migration acceptance

The operator demonstrated on 12 November 2026: the exact 0037 production snapshot restored to an isolated `mysql:8.0.46` container with 38 tables, 2 members and 0 NULL member referral codes, and the reviewed `0038_shared_member_contacts` index-only SQL successfully changed the two contact indexes to nonunique while retaining the unique referral-code index. This evidence supports a **scoped migration compatibility acceptance**, not validation of every new application feature against MySQL 8.0.

The source pre-migration audit defaults to **BLOCKED** on MySQL versions other than 8.4. It now accepts **only** MySQL 8.0.46, an applied `0037_versioned_financial_amounts` head and a packaged `0038_shared_member_contacts` head **if** the responsible operator explicitly provides all of:

- `NISVARTHA_MYSQL80_0038_COMPATIBILITY_APPROVED=true`: operator acknowledgment of the identified version-specific compatibility risk;
- `NISVARTHA_MYSQL80_APPROVED_RELEASE_SHA`: the same verified 40-hex-character artifact SHA, never an unrelated build;
- `NISVARTHA_MYSQL80_0038_REHEARSAL_REF`: the audit record identifier for the real isolated restore/SQL rehearsal. A reference is not itself the underlying evidence.

These fields are accepted by the **read-only audit only**; they do not invoke migration, assert off-host backup, enable financial flags, override release manifest checks, or approve deployment. Unsupported versions, stale heads, invalid/no evidence, mismatched SHA and missing operator acknowledgment are still blocked. Every other release-readiness prerequisite remains independent: encrypted off-host backup with restore evidence, approved financial operations, original SRS and signed operational cutover.
