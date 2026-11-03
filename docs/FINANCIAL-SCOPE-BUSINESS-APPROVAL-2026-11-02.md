# Financial scope: stakeholder business approval and release gates

**Decision status (2026-11-02):** The project stakeholder explicitly approved proceeding with planning/development scope for paid E-PIN, commission and a 1:3 financial plan in the project discussion. This is **business intent**, not a signed trustee resolution, revised SRS, audited financial model, counsel opinion, payment-provider authorization, or permission to activate a financial scheme.

**Baseline:** `Nisvartha_Foundation_SRS_v1.0.docx` (project-provided draft), §2.4, §6.5, FR-013/014, FR-033/034 and risk R-01/R-02/R-08. The SRS explicitly requires a separately approved payments specification and legal review of matrix/referral/rebirth/wallet/payout functions **before development or activation**. This decision does not silently rewrite the SRS. Before advancing into functional financial development, publish and sign a revised, versioned financial SRS/approval addendum with the authorized Foundation signatories.

## Proposed scope for evaluation, not operative compensation policy

The project-provided concept mentions ₹15,000 joining, ₹1,000 direct referral, 1:3 forced placement, five levels and rebirth accounts. These are **unverified examples**, not approved fee amounts, lawful compensation terms, accounting facts, verified forecasts or production configuration. No recruitment-triggered commission/level payout should be implemented solely on this conversational approval.

### Mandatory compliance decision

Qualified Indian legal counsel, authorized Foundation trustees and a finance lead must independently examine the **actual economic substance**, not just the code's naming or marketing copy, under applicable Indian law including:

- Consumer Protection (Direct Selling) Rules, 2021, Rule 10, and the 2023 amendment defining network-of-sellers consideration solely from sale of goods or services.
- Prize Chits and Money Circulation Schemes (Banning) Act, 1978, particularly the definition of money circulation linked to member enrollment and the prohibition on conducting such schemes.
- Any additional applicable charity, trust/society/Section 8 company, fundraising, tax, GST, income-tax withholding, AML/KYC, RBI/payment-aggregator and consumer protection obligations as determined by counsel.

Official source references:
- https://consumeraffairs.gov.in/public/upload/admin/cmsfiles/whatsnews/The_Consumer_Protection_Direct_Selling_Rules%2C_2021_whatsnews.pdf
- https://egazette.gov.in/WriteReadData/2023/246732.pdf
- https://www.indiacode.nic.in/bitstream/123456789/1628/1/197843.pdf

**Design boundary:** If the proposed arrangement compensates people primarily for enrolling fee-paying members or for matrix fills/rebirth rather than legitimate independently valued sales of goods/services, do **not** build or enable that mechanism. Counsel must review the scheme, funding source and compensation triggers before any contrary assumption.

## Financial SRS addendum: inputs required from business, legal and finance

1. **Entity and authority:** verified legal entity, authorized trustees/directors, signed approvals, permitted objects and commercial activities; legal opinion on the *specific* program, including why any remuneration is not a prohibited enrollment-driven scheme.
2. **Genuine offering:** separately identifiable product/service, real buyer rights and demonstrable standalone value, legitimate pricing and taxes. Keep charitable donations and commercial receipts separate; do not promise guaranteed earnings.
3. **Payment contracts:** gateway/merchant of record, settlement webhook signatures, deduplication keys, captured vs authorized vs settled vs refunded vs chargeback states, ledger/journal ownership, reconciliation, refunds and consumer grievance policy.
4. **E-PIN commercial purpose:** Stakeholder clarification on 3 Nov 2026: there is **one payment at registration** and no installment PIN or installment payment. The existing internal `ACTIVATION` value denotes the registration-only PIN. Define the actual registration offer, issuer authority, verified payment/order, expiry, atomic idempotent issuance, secure one-time delivery, cancellation/refund, and single-use redemption under row lock with immutable audit trail. **Do not** equate a staff preview or candidate PIN with paid entitlement.
5. **Any lawful sales commissions:** documented sale-based eligibility, recipient contract, seller vs customer distinctions, independent calculation proof, funding and reserve source, taxes/withholding, reversals/clawbacks, maximum liability, no registration-only rewards, payout ledger and cash-out controls. A 1:3 tree is never by itself evidence of lawful consideration.
6. **Mathematical and accounting reconciliation:** independently reproduce all counts, fees, taxes, commissions, retained reserves, rewards, refunds, liabilities and edge cases; forbid unfunded or guaranteed returns and clarify any rebirth/re-entry concept.
7. **Security and production:** KYC/identity requirements proportionate to obligations, RBAC and dual approval, least privilege, rate limits, secret protection, immutable audit, strong cryptographic entropy, unique keys, concurrent spend prevention, automated DB rollback/failure tests, reconciliation alerts, backup/restore, production readiness and rollback.

## Implementation decision and verification gates

- **Authorized now:** document scope, clarify legal/finance requirements, inspect MEGA's reusable nonfinancial architecture and contracts, build no-money non-issuing validation and read-only reporting, test with synthetic data only.
- **Not authorized by this record alone:** real E-PIN sale/issuance/redemption, payment gateway activation, monetary referral/matrix/rebirth credits, wallets, payout calculation or disbursement, public compensation advertising.
- **Do not weaken existing guards:** keep `scripts/check-paid-epin-hold.mjs`, current SRS constraints, feature flags, RBAC and current draft PR boundaries intact until approved revisions and independent written legal clearance are reviewed.
- **Future gates:** signed versioned addendum and counsel opinion → approved product/payment and lawful compensation policy → auditable implementation with append-only migrations and deterministic idempotency → verified source-of-truth transactions/reconciliation → `npm run verify` and exact-head API/Web CI green → explicit deployment authorization.
- **Git safety:** stacked draft branch only, base PR #13; no default branch update, merge, release, or production state change as part of this decision record.

This record documents **what the stakeholder said**, not that legal compliance has been established or all listed controls have been accepted.
