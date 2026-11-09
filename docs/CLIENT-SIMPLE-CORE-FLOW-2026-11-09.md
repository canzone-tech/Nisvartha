# NISVARTHA — simple client workflow (owner correction, 9 November 2026)

**Status:** owner-confirmed functional target. Supersedes **only conflicting onboarding/approval and UI assumptions** in older milestone notes. Technical implementation and production release are not approved by this document.

## The product in one flow

**Admin creates one root member → Admin issues one-time E-PINs → member registers with an unused E-PIN and an inviter's 8-character referral code → member becomes ACTIVE immediately (no separate Admin approval) → member is positioned in the global 1:3 matrix → qualifying direct-referral and matrix-level earnings are recorded → level-4/5 rebirths occur → member views wallet and requests payout.**

### Admin

- Create/initialize exactly **one designated root member**, with the first matrix position (sequence 1). Root has its own stable referral code, and this is the code used for initial invited registrations. This special bootstrap may bypass the ordinary inviter/PIN requirement **only** under audited Admin authorization. It is not a general-purpose PIN-free member registration endpoint.
- Generate, inventory and distribute one-time registration E-PINs; an E-PIN cannot be reused, forged or accepted after expiry. Admin issuance is the registration authorization, **not** a request for a subsequent per-member approval.
- View member accounts, matrix positions, earnings, wallet ledger and payout requests. Manage only legitimate exceptions, suspensions, and authorized payout evidence; **do not** introduce an ordinary member-approval queue.

### Member

- Register with valid unused Admin-issued E-PIN, inviter/referral code, own contact/credential details and the minimum required consent. Successful registration activates the account and places the original matrix position **in one transaction**. On any failure, neither PIN nor placement/earning event may be partly committed.
- Log in using registered email **or** unique **8-character uppercase alphanumeric A-Z0-9 referral code**, plus the same password. Referral code is not a password, is stable and unique. Do not break existing issued 22-character invitation links without a controlled migration/compatibility plan.
- Dashboard shows the referral code prominently with Copy and Share, their own matrix/rebirth positions, earnings, wallet balance and payout-request status. No technical policy/version/sandbox/legal-debate panels.
- A member may continue direct invitations after the member's original or any rebirth position completes. Member account and matrix-position lifecycle are distinct.

### Direct referral and matrix placement are different

- **Direct referral:** the inviter relationship is credited to the actual member whose referral code was used, regardless of where the new member is physically placed in the matrix. Owner reference amount: **₹1,000** for a qualifying direct referral; eligibility and funding must match an authorized lawful commercial policy.
- **Matrix:** forced global breadth-first **1:3** order. Fill a position's three child slots left to right; if all are full, continue into the next available slot at the next level, left to right. The inviter is **not guaranteed** to be the structural matrix parent.
- **Five levels:** 3, 9, 27, 81, 243 positions beneath each root position; owner reference earnings per complete level are ₹2,500, ₹5,000, ₹10,000, ₹50,000, ₹90,000 respectively. Each level must be credited at most once when its actual completion condition is met; no premature credit.

### Rebirth

- Each original **and** rebirth position has an independent five-level cycle, belonging to the same member.
- At level 4 completion, generate **one** rebirth position; at level 5, generate **three additional** rebirth positions, placed in the global next available slots. Rebirth-of-rebirth follows the same rule recursively, with no approved business-generation maximum.
- Once all four are generated, **that source matrix position** becomes **COMPLETED_READ_ONLY** for new position-level accrual/rebirth. Its history remains accessible. Already earned unsettled balances are not forfeited. The member login and eligible direct referral ability remain active.

### Wallet and payout

- **One wallet view per member**, backed by authoritative immutable earning/settlement/payout records, not an editable balance field. Explicitly distinguish **pending/earned**, **available**, **reserved/requested**, **paid**, **reversed**; no double spend, duplicate payout or balance below zero.
- A member submits a payout request against **eligible available** balance; the Admin can record authorized external payment and reference. Refund/reversal, retry and reconciliation must remain auditable. **No actual funds transfer or live payout enablement without separate finance/legal approval.**
- Keep the existing offline-transaction evidence model until the funding and wallet/payout source-of-truth contract is authorized. **An Admin-issued PIN proves registration permission, not necessarily that money was received**; do not fabricate evidence or silently create financial liabilities.

## Only the necessary screens

| Admin | Member |
|---|---|
| Dashboard | Registration / Login |
| Root member setup (one-time) | Dashboard + 8-character referral code |
| E-PIN generation/inventory | My referrals / 1:3 matrix |
| Members / matrix view | My rebirth positions |
| Earnings, wallet, payout management | Wallet / payout requests |

Use the existing client v1.1 navy/green/gold design, shared form components and responsive/accessibility standards. Keep the workflows compact, human-readable and consistent, not an ERP-style maze. **No redundant approval pages, prototype text, debug switches, or irrelevant technical/legal-policy content in Admin/member UI.** Preserve short, accessible privacy and membership disclosures if legally required at data collection or transaction steps; hiding internal policy settings does not remove regulatory obligations.

## Verified source gap (integration baseline `2033a38d9ddb928420c2cb9bd13ee7e66832ac71`)

- `backend/src/members/member.service.ts` creates `SUBMITTED` membership applications, leaves new accounts `PENDING` and requires `markReview`/Admin `decide` to activate; this **conflicts** with the newly confirmed valid-E-PIN auto-activation requirement.
- Current referral IDs are 22-character base64url in service, DTO, frontend and referral link helper. Login currently finds account by email only.
- A 1:3 global matrix/rebirth and offline earnings/settlement primitives already exist behind feature flags; reuse them rather than rebuilding. A member wallet with reservation-aware payout requests is **not** yet established as an accepted/verified live workflow.
- `fix/m1-public-contact-form-2026-11-09` is an **unmerged exploratory branch**, not a release or client requirement. Freeze additional public-form design work while delivering the client-core journey.

## Minimal execution order and acceptance gate

1. **Registration + root + code (M3):** Admin root bootstrap exactly once; cryptographically generated unique 8-character code; two password login identifiers; PIN redemption+account ACTIVE+matrix placement in one transaction; legacy compatibility; duplicate/replay/concurrency and compiled-browser UAT.
2. **Matrix + rebirth (M4–M5):** prove BFS slots, exact 3/9/27/81/243 completion, inviter independence, recursive L4=1 / L5=3, source-position closure, concurrent/retried generation without duplicate IDs.
3. **Wallet + payout (M6):** use authoritative earning ledger and transactional reservation before payout, negative-balance/duplicate prevention, Admin evidence/reconciliation, approved eligibility rules, isolated MySQL tests and compiled UI UAT.
4. **Release (M7):** root `npm run verify`, Web/API/Local Parity/Compiled CI at exact integration SHA; operational backup/restore and client UAT. Existing completed M0 stays locked.

**Business correction:** "Admin generated the E-PIN" means no extra human membership approval is needed. Financial authorization, verified receipt and lawful compensation eligibility are distinct internal controls; do not misrepresent them as another member approval or clutter the UI. No live financial activation is authorized solely by this owner conversation.
