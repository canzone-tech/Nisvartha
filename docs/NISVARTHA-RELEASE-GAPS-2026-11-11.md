# NISVARTHA — source-derived final release gap register (11 November 2026)

## Confirmed owner inputs

- One ₹15,000 registration payment, no instalments; ₹1,000 direct referral;
  1:3 five-level matrix, recursive 1 + 3 rebirth, member-level wallet.
- Q8-A: unused cancelled paid PIN can be replaced without an additional
  ₹15,000 or double-paid accounting, preserving history.
- Q36-A: cancellation is not a bank refund; Admin records completed
  external refund independently with reference/evidence/date.
- Q37-A: old E-PINs remain legacy; only new verified paid batches count.
- Owner reported separate legal and finance approvals already received.
  This entry acknowledges that report; no counsel signature, approval reference,
  program version or attached signed financial SRS was present in the repository
  at this audit. Do not represent absence of repository evidence as a denial
  of the owner's statement.

## Q37 verified paid registration allocation — 11 November checkpoint

Append-only migration `0035_verified_paid_member_redemptions` adds a one-to-one
receipt-provenance allocation between a *new verified paid* registration E-PIN
and its actual member. Allocation, E-PIN claim, member creation, invitation and
matrix placement commit in one MySQL transaction. Legacy E-PINs have no paid
allocation and are never retroactively valued.

The Admin summary reports authoritative paid receipts, used paid PINs,
matched member allocations and fail-closed discrepancy indicators for missing
allocations, extra allocations, duplicate manual registration-sale records and
refund count exceeding source receipts. An Admin cannot record a second
independent ₹15,000 registration sale for a verified-paid E-PIN; the shared
paid-batch bank reference remains its source of truth. This does **not**
represent a separate product/service sale, compensation entitlement or a
second payment. No automatic referral/matrix rewards are minted by a paid
registration fee. Existing earned-wallet and payout flows still require
independent qualifying-sale funding policy.

## Engineering state

- Verified paid E-PIN accounting (0032) exists and is source-of-truth MySQL.
- Q8 replacement now uses append-only 0034 and one-to-one predecessor/successor,
  refund/replacement row locks, no new paid receipt and real MySQL smoke.
- Existing auto-active member placement does **not** also create monetary
  level earnings. Matrix compensation currently requires
  `MEMBER_PIN_AUTO_ACTIVATE_ENABLED!=='true'`, and its confirmed offline sale
  has a separate receipt reference from the verified paid E-PIN batch.
  Consequently, auto-crediting from paid E-PIN issuance is **not yet a reconciled
  financial contract**. Do not work around this by enabling flags manually.
- Current `client-review` compiled release profile explicitly pins
  `MEMBER_COMPENSATION_ENABLED`, `MEMBER_COMPENSATION_APPROVED`,
  `PAID_PIN_ISSUANCE_ENABLED`, `PAID_PIN_ACCOUNTING_APPROVED` to false.
  Building a new authorized financial-capable profile requires its own reviewed,
  signed exact-version commercial/financial source-of-funds, refunds,
  reversals/clawbacks, taxes and audit/reconciliation contracts and parity tests.

## External and on-host release tasks

- Verify actual signed financial approval reference/version, legal member terms,
  refund/grievance and privacy versions via trusted private operator records;
  update release design, not historic SRS files.
- Validate deployment host connectivity/access, MySQL 8.0.46 vs CI 8.4,
  current live DB migration head and immutable existing data.
- Quiesced consistent MySQL + encrypted private-media backup, off-host escrow,
  isolated restore and rollback rehearsal must be demonstrated with actual data.
- Create reviewed compiled-only release from exact green SHA and matching
  feature flags, then verify server service identity, Node 22, Apache/TLS,
  private secret env/PIN vault and ClamAV. Do not clone source to server.
- Live Admin/member full registration, E-PIN, matrix, wallet, payout, privacy,
  content, mobile, keyboard/accessibility and reconciliation UAT, followed by
  owner sign-off. No production cutover was done in this source-only change.
