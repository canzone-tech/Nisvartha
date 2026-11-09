# NISVARTHA — M0 baseline audit and regression contract

**Audit date:** 9 November 2026  
**Scope:** M0 engineering baseline only; no change to member/referral/financial state.  
**Reviewed integration ref:** `feat/versioned-matrix-sandbox-policy-2026-11-05`, HEAD `3837c7079f3f074a8f6928f58f131eea11637e72` before this M0 branch.  
**Owner-approved milestone definition:** [Milestone contract, 9 Nov 2026](MILESTONE-CONTRACT-AND-UI-2026-11-09.md).  
**Reference:** [SRS v1.0 traceability](SRS-TRACEABILITY.md); the original SRS is a **baseline draft awaiting authorized sign-off**, not a signed financial specification.

## 1. Source and architecture inventory

| Area | Inspected source | Current contract |
|---|---|---|
| Frontend | `frontend/app/`, `frontend/components/`, `frontend/lib/`, `frontend/package.json` | Next.js 16.4.5 App Router, React 19.3.0, TypeScript, approved client v1.1 site copy and shared styles |
| API | `backend/src/app.module.ts`, `backend/src/{members,staff,cms,enquiries,media,finance,health}/` | NestJS 11, REST `/api/v1`, backend validation, authorization and rate limits |
| Database | `backend/prisma/schema.prisma`, `backend/prisma/migrations/` | Authoritative MySQL 8.4 with Prisma 6.19; **23 ordered migration directories**, `0001_public_enquiries` through `0023_unique_settlement_reference`; existing migrations immutable |
| Identity | `backend/src/members/member.service.ts`, `member.dto.ts`, `frontend/components/member-auth-form.tsx` | Email+password today; separate member and single ADMIN staff roles; revocable sessions |
| Matrix | `backend/src/members/matrix-placement.service.ts`, `member-compensation.service.ts` | Distinct direct-inviter relation and breadth-first 1:3 positions; enabled behind explicit gates |
| Operations | `scripts/verify-local.sh`, `scripts/verify-deployment.sh`, `scripts/smoke-fullstack-artifact.mjs`, `infra/` | Node 22, disposable MySQL verification, compiled API/Next runtime with health/readiness, source-free artifact, backup/restore and deployment preflight checks |

All previously applied migrations are left untouched. All financial activity stays behind existing feature/approval controls. The M0 changes do not add any new payment, payout, wallet, E-PIN issue or member mutation path.

## 2. Baseline CI evidence

The exact **pre-M0 integration SHA** `3837c7079f3f074a8f6928f58f131eea11637e72` had completed successfully:

| Job | Evidence |
|---|---|
| API CI | https://github.com/canzone-tech/Nisvartha/actions/runs/42592993385 |
| Web CI | https://github.com/canzone-tech/Nisvartha/actions/runs/42592993471 |
| Local Parity CI — same `npm run verify` entrypoint | https://github.com/canzone-tech/Nisvartha/actions/runs/42592993408 |
| Full Stack Compiled Release Candidate — PR | https://github.com/canzone-tech/Nisvartha/actions/runs/42592993384 |
| Full Stack Compiled Release Candidate — push | https://github.com/canzone-tech/Nisvartha/actions/runs/42592983604 |

These results were for that SHA only. **M0 candidate and post-merge HEAD require their own exact-SHA green checks** before the engineering gate can be called complete. A green CI run does not imply public launch approval, legal clearance or that all future milestones are finished.

## 3. Root-cause finding, repair and permanent gate

**Confirmed production-parity defect:** `scripts/smoke-web.mjs` and `scripts/smoke-fullstack-artifact.mjs` already expected `GET /auto-pool-plan` to return **200** with the controlled informational notice, while `scripts/smoke-deployed-release.mjs` and its unit fixture `scripts/test-release-smoke.mjs` still expected **404**. `docs/SRS-TRACEABILITY.md` also reported 404. Production deployment verification would reject the otherwise passing release candidate; previous CI did not catch the conflict because each suite validated a different expected contract.

**M0 repair:** Preserve the agreed informational route (no online enrolment) as HTTP 200. Apply explicit page-level `robots: {index:false,follow:false}`, independently of the inherited layout setting. Use a single assertion helper `scripts/auto-pool-contract.mjs` from **web, compiled-artifact and deployed-origin** smokes. The helper enforces HTTP 200, the exact controlled-enrolment notice and a rendered `noindex` robots meta tag. The release-smoke fixture now tests bad 404, missing noindex and missing disclosure as failures. Correct SRS traceability wording without deleting the SRS compliance requirement.

**Publication boundary:** The route being informational and non-indexable is a **technical gate**, not evidence that the underlying programme, fee, recruitment mechanics or earnings claims are lawful. SRS v1.0 §6.5 and FR-013/FR-014 require independent legal approval. Any reviewer requiring unpublished status or different disclosure text must approve a change through a separate content/compliance decision; do not bypass the automated noindex/notice gate.

## 4. Existing behavior versus next owner-approved contracts

| Milestone | Confirmed current behavior | Outstanding implementation gate |
|---|---|---|
| M1 public website | Existing approved-template copy, routes, mobile/desktop browser gates and enquiry service | Official Foundation profile, address/contacts, assets, activity evidence; privacy/terms approval; visual/accessibility sign-off |
| M2 CMS/Admin | Staff API/role controls, content/enquiry/media records, staff audit and local recovery smoke | Real authorized admins, editorial content rights/consent evidence, production operations, human UAT |
| M3 referral identity | Current code creates 22-character base64url referral codes, validates 22-character inviter codes, and authenticates by **email+password only** | Owner-approved **unique 8-character A-Z0-9** code, password login with email **or** referral code, migration compatibility, dashboard code prominence, real-DB/HTTP/browser tests |
| M4 placements | Code uses width 3, max depth 5, global breadth-first placement and unique entries | Milestone-specific concurrency/ordering acceptance and source-of-funds controls before any financial enablement |
| M5 rebirth lifecycle | Level 4 makes one re-entry; level 5 makes three; recursive queue and source entry-key idempotence; `completedAt` recorded at L5; `MAX_REBIRTHS_PER_ACTIVATION=128` limits an individual cascade | Explicit durable **completed/read-only parent position** and no further position-level accrual, while owning **member login/referral and other positions remain usable**; bounded-work recovery, recursive-generation real-DB tests |
| M6 financial records | Offline confirmation/earnings/settlement evidence exists, gated | Legal and finance approval, verified transaction/reversal policy, controls and reconciliation; nothing here authorizes production financial enablement |
| M7 integrated release | Existing compiled-server and full CI verification | Domain, TLS/host operations, approved flags, backup restore, local human UAT, deployment sign-off |

**Important:** owner-confirmed business inputs and completed API simulations do not replace signed legal clearance or actual settled funds.

## 5. Freeze and execution rules

1. M0 contract may be marked **engineering verified** only after code review, no unintended file changes, CI passing on the exact M0 integration merge SHA and explicit stakeholder acceptance. **M1 begins next**; M3 and M5 requirements are documented but implementation waits for their milestones.
2. Never silently update `main`, modify old migrations, transfer code/data from another client, or reinterpret a test fixture as business authority.
3. If a frozen milestone has a genuine defect or new requirement, make the smallest independently reviewed change, add a regression test and re-run the impacted milestone gates and `npm run verify` in the disposable test environment.
4. Client-facing forms must be clean, responsive, keyboard accessible and use existing components. No demo/test labels or irrelevant internal technical/policy jargon; retain legally required concise notices and consent where applicable.
5. The verified handoff for a developer working on the **approved integration branch** remains `git pull` then `npm run verify` on a machine with Node 22, Docker Compose and Chromium. This command is **not** for production databases.

**M0 acceptance ownership:** code/CI technical acceptance ≠ owner content approval ≠ independent legal/finance review ≠ production release authorization.
