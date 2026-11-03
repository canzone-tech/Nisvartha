# Decision: Nisvartha has one payment at registration, no installments

**Confirmed stakeholder clarification:** 3 November 2026: "sirf ek hi type ka payment hai registration ke time par." This supersedes earlier Nisvartha code assumptions imported from MEGA. The uploaded `Nisvartha_Foundation_SRS_v1.0.docx` does not establish an installment payment schedule; §§2.4/6.5 and FR-033/034 still gate actual monetary functionality and member compensation.

## Canonical Nisvartha product behavior

- Only **one proposed registration-time payment**; no installments or later recurring membership payments are specified or assumed. A registration fee amount, gateway, merchant, taxes, refund terms and entitlement have **not been finalized** by this clarification.
- The one E-PIN purpose is registration. Existing internal code value `ACTIVATION` and hash namespace `epin-activation` are retained for compatibility with current *unissued* candidate/security contracts. They mean a **registration PIN**, not a second payment after registration and not paid entitlement.
- Legacy MEGA `INSTALLMENT` PIN requests, hashes presented as a registration PIN, and redemption contexts are rejected. New UI has no installment selector.
- A future authorized record may hold a single `registrationFeeSnapshot` and `currencyCodeSnapshot`. Do not carry over `installmentAmountSnapshot`, `installmentCount` or installment due dates from MEGA.
- Existing `ADMIN`/`SUPER_ADMIN` can only preview a registration E-PIN policy under the SRS HOLD; preview returns zero issued PINs. No activation, payment acceptance, live registration PIN issuance, redemption, commission, wallet or matrix transaction is implemented.
- MEGA supports multiple PIN types; it is **reference implementation**, not Nisvartha's business specification. Historical descriptions of MEGA's features remain source provenance, not operative Nisvartha requirements.

## Acceptance / future implementation boundaries

- Backend candidate validation and staff DTO allow only `ACTIVATION` (optional for legacy compatibility, defaults to `ACTIVATION`). Explicit `INSTALLMENT`, null or unknown type are rejected.
- E-PIN verifier accepts `ACTIVATION` and rejects wrong purpose; current synthetic precondition checker rejects legacy type and no longer requires installment commercial fields.
- Compiled API/MySQL, synthetic credential tests, SRS HOLD static gate, frontend lint/typecheck/build/browser UAT and `npm run verify` are regression gates.
- Only after independently reviewed lawful program and signed approved financial specification may an authoritative, settled, one-time registration payment be linked to a single-use PIN issuance/redeem flow. Recruitment-driven payouts/matrix financial incentives remain legally gated.

This decision is a **domain correction**, not a signed legal opinion or authorization to start live financial transactions. No applied migration is rewritten or production branch changed.
