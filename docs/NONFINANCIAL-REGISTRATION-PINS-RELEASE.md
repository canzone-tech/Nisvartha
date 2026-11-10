# Registration E-PIN and offline activation contract

Only ADMIN creates single-use registration E-PINs. The E-PIN is a registration credential; it does not itself collect ₹15,000 or transfer money.

## Authoritative lifecycle

- Migrations 0015/0016 provide registration PIN batches, purpose-bound hashes and encrypted Admin-visible codes.
- ADMIN creates 1–50 high-entropy E-PINs idempotently. Full codes are encrypted at rest and inventory reads are audited.
- Public or staff-assisted registration atomically consumes one available E-PIN with creation of a PENDING member/application. Optional inviter attribution is persisted separately.
- Approval does not accept a client-supplied amount. When `MEMBER_COMPENSATION_ENABLED=true`, the server requires Admin to record external transaction reference/evidence/time and always records the fixed amount **₹15,000**.
- After successful offline-transaction confirmation, the member becomes ACTIVE, any eligible direct inviter receives one deterministic **₹1,000** earning, and the member gets the next breadth-first 1:3 matrix position.
- Matrix level completion creates deterministic earnings of **₹2,500 / ₹5,000 / ₹10,000 / ₹50,000 / ₹90,000**. Level 4 adds one rebirth entry; level 5 adds three. Rebirth entries use the same global next-available placement sequence.
- Earnings start as `EARNED`. ADMIN records the actual external payout reference/evidence/time to mark an earning `SETTLED`. The application does not initiate bank/UPI/cash transfers and has no member wallet.

## Feature gates

`REGISTRATION_ACCESS_PIN_ENABLED`, `MATRIX_PLACEMENT_ENABLED` and `MEMBER_COMPENSATION_ENABLED` are independent fail-closed flags. Compensation requires real registration E-PIN mode, member portal/applications, approved terms/privacy versions and matrix placement. Synthetic PIN mode cannot be combined with the operational compensation path. API/web build flags are included in release-profile parity checks so a compiled frontend cannot silently disagree with the API.

## Integrity and retry behavior

PIN redemption is one-time and row-locked. Matrix allocation serializes the global sequence using the authoritative `matrix_state` row. Offline sale confirmation, direct earnings, matrix-level earnings and rebirth entries use deterministic/unique keys. Repeating an already-committed approval with the same transaction request/evidence returns the existing approval instead of creating duplicate sale, earning or matrix entries. Offline settlement requests are likewise idempotent and row-locked.

## Verification

Root `npm run verify` is the CI/local parity entrypoint. The compiled real-MySQL compensation smoke covers fixed ₹15,000 activation evidence, ₹1,000 direct earning, all five matrix level amounts, the 1+3 rebirth rules, member/Admin read views, lost-response approval retry and an Admin-recorded offline settlement. Default public/release-preview builds keep member compensation disabled.

## PIN vault

The API must receive a protected independently generated 32-byte base64url `PIN_VAULT_KEY` whenever real registration PIN inventory is enabled. Losing or replacing this key without re-encryption makes encrypted PIN display unavailable. Never place the key in frontend bundles, Git, command history or logs.
