# Q37-A — Verified Paid Amount per New E-PIN Batch (2026-11-10)

## Confirmed owner decision

Existing E-PINs remain **LEGACY**. They are never automatically valued at ₹15,000 or included in new paid amount totals. Only newly created, **Admin-verified** paid E-PIN batches enter the paid register. One PIN has a fixed snapshot of **₹15,000 (1,500,000 integer paise)**, and a single evidenced offline transaction may cover 1–50 PINs in one batch.

Q36-A is independent: cancelling an unused PIN does not mean any money was refunded. Only when the Admin records a **completed** offline transfer with independent bank reference, evidence reference, and paid timestamp does its status become REFUNDED.

## Authoritative records and invariants

- `registration_pin_batches`: authoritative quantity and issuer; all historical batches preserved.
- `registration_pin_paid_batches`: one-to-one record for a **new** batch, independently verified offline receipt reference, evidence ref, received timestamp, amount snapshot and Admin verification identity. **No backfill** of legacy batches.
- `financial_settlement_references`: unique external bank reference across PIN payments, payout settlement, earning settlement and PIN refunds. Paid issuance and reference reservation happen in **one MySQL transaction**.
- `registration_pins`: one-time encrypted bearer; global identity and registration semantics unchanged. A paid source batch is not an authorization to create income for referring members.
- `registration_pin_refunds`: completed offline refund evidence, linked to a cancelled unused PIN. No refund amount is inferred for a legacy PIN in the new paid totals.
- Fixed amounts are computed in integer paise. The server checks `verifiedAmountPaise === quantity * 1_500_000`; the DB requires a valid fixed unit and a multiple within the 1–50 limit.
- No online payment processor, payment initiation, auto-commission, spendable wallet funding or automatically credited financial earnings are introduced by Q37.

## Dashboard numbers

All use only the **verified paid** batch relationship, with MySQL as source of truth:

| Name | Definition |
| --- | --- |
| Verified gross paid | Sum of new verified batch receipts |
| Cancelled, refund pending | Paid-batch PINs cancelled with no completed refund × ₹15,000 |
| Offline refunds completed | Paid-batch PINs with completed refund evidence × ₹15,000 |
| Net after refunds | Verified gross paid – completed refunds |
| Verified paid PINs | Count from verified paid batches, irrespective of present PIN lifecycle |
| Legacy E-PINs | Remain visible in inventory with no paid amount; excluded from every amount above |

These are paid-amount accounting facts, **not** available cash, payout funds or proof that any compensation plan is lawful or approved.

Admin inventory continues as a responsive table with status and payment-provenance filters, bounded pages, and encrypted full-code reads audited for authorized Admin only.

## Release safety

The new Admin action `POST /cms/membership/registration-pins/verified-paid` requires **both**:

- `PAID_PIN_ISSUANCE_ENABLED=true`
- `PAID_PIN_ACCOUNTING_APPROVED=true`

Unless BOTH are set, it returns 503 without creating any paid register entries or issuing codes. Client-review packages explicitly pin both values to `false`; their release-manifest preflight rejects either flag being enabled. The original nonfinancial access-code mode remains in the held client-review profile, while a properly approved paid profile refuses unverified legacy issuance.

These environment switches are technical safeguards, **not** a substitute for independent policy/legal review. The initial SRS holds financial/paid E-PIN and recruitment-based compensation outside its approved scope. Q37's owner choice does not independently clear that hold.

## Repeatable verification

`npm run verify` and API CI include `scripts/smoke-verified-paid-pins.mjs`, which runs the compiled API against isolated real MySQL, seeds a legacy PIN, records a synthetic verified batch, rejects wrong amounts and duplicate references, checks Admin-only access and exact filtered totals, then cancels/refunds and verifies the net. Existing nonfinancial E-PIN smoke must prove paid issuance remains denied with default-off flags. Existing migrations are immutable; `0032_verified_paid_pin_batches` is append-only.

No live production server, database or financial compensation enablement was performed as part of this work.
