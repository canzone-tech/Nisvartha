# Offline donation accounting (single ADMIN)

This is a standalone **donation-only** register, not a joining/payment/MLM engine or bank gateway. One ADMIN records bank references as PENDING, then verifies independently against off-system bank evidence and marks RECONCILED or REJECTED. No second-Admin approval is required. Each decision has immutable evidence metadata, audit events and replay-safe request keys. Amounts are integer paise and a bank reference is unique. No member entitlements, PIN sales, matrix placement, referral commissions, rebirth IDs or payouts are created. Reconciled status is **Admin attestation**, not an automated assertion from the bank.

`DONATION_ACCOUNTING_ENABLED=false` by default on backend and web. Enable only with Foundation authorization, actual bank evidence handling controls, privacy/data retention and operator review. Real financial product and payment gateway remain separate.


## Offline refund lifecycle (migration 0020)

A single ADMIN can reserve a PENDING refund against a previously RECONCILED standalone donation. The service locks the original MySQL donation row before summing pending and confirmed refunds so that simultaneous requests cannot over-reserve. Every outgoing reference and UUID request key is unique, events are append-only, and confirmed refunds reduce net donation totals. Rejected requests release their reservation. A refund is confirmed only after ADMIN bank evidence review. No bank API, automated transfer, joining-fee, recruitment commission or matrix payout is provided.
