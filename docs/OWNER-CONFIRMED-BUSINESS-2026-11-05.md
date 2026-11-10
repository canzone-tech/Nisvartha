# NISVARTHA — Owner-confirmed business inputs (2026-11-05)

**Status:** Owner explicitly reconfirmed the values below during development. These are confirmed business inputs, not unverified flyer figures.

Owner confirmation of the business plan must remain distinct from any claim that real payment settlement, financial reconciliation or legal authorization has been completed.

## Nisvartha rules — never MegaMitra binary

- Joining fee: ₹15,000 once, no monthly MEGA installments.
- Direct referral: ₹1,000 per direct referral.
- Forced 1:3 breadth-first top-to-bottom/left-to-right matrix with 3 slots per parent.
- Matrix levels: 3 / 9 / 27 / 81 / 243 positions = 363 total.
- Payout per level: ₹2,500 / ₹5,000 / ₹10,000 / ₹50,000 / ₹90,000; sum ₹1,57,500 per completed ID.
- Four rebirth/re-entry IDs: 1 on level 4 and 3 on level 5. The flyer says rebirth IDs occupy lowest available matrix positions.
- Unlimited direct referral relationships are separate from forced placement.
- Account types: ADMIN and MEMBER only.

## MegaMitra reuse boundary

Reference: https://github.com/canzone-tech/megamitra — reuse architecture and financial invariants (authoritative MySQL, versioned effective policy, idempotent source keys, transactional allocations, immutable ledger and adjustments). Do not import binary LEFT/RIGHT pairing logic.

## Local UAT vs real operation

The existing database supports synthetic local-only reference events, not actual money receipts, settlement, payable commission or member wallet liabilities. Synthetic results must remain marked as such. A real payment/commission implementation requires verified settlement, refund/reversal rules, funding reconciliation, and separate activation authorization. Owner confirmation of amounts does not itself establish these technical and operational conditions.

## Owner refinement — 9 November 2026 (superseding details)

The milestone-wise accepted rules and client-facing UI quality requirements are maintained in [MILESTONE-CONTRACT-AND-UI-2026-11-09.md](MILESTONE-CONTRACT-AND-UI-2026-11-09.md). In particular:

- Each original or rebirth position independently creates **one** new position at level 4 and **three** more at level 5; the same rule repeats for rebirth-of-rebirth positions. Re-entry is not a new member account or an additional joining fee.
- Once all four rebirth positions are created, the **source matrix position** is complete and read-only for new position-level financial activity. Its history remains visible; its member login and other active positions remain available.
- The **owning member may continue inviting** through the same referral identity after a parent position closes. Any eligible direct-referral earning belongs to the member-level referral relationship, not to the closed parent position; financial activation still requires separate lawful approval.
- Future member referral codes are **unique eight-character uppercase alphanumeric** identifiers used both for invitation and (with password) as an alternative to email sign-in; live/legacy 22-character codes require a safe migration plan.
- User-facing forms and dashboard must use the approved professional design system, omit irrelevant internal/test policy language, and preserve legally required concise notices/consent.

These are **contract additions pending implementation and verification**, not evidence that the repository currently implements or may lawfully operate the revised rules.
