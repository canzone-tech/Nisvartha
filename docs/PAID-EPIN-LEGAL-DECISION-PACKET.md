# Nisvartha Foundation — Paid E-PIN Legal & Commercial Decision Packet

**ID:** NIS-FND-CR-EPIN-002  
**Status:** Draft for independent legal, trustee, finance, security and product review — NOT APPROVED  
**Prepared:** 1 November 2026  
**Source baseline:** Nisvartha Foundation SRS v1.0 (30 October 2026), sections 2.4, 6.5, 10 and 15, FR-029–034; repository Phase 3 membership boundary.

## 1. Purpose and STOP gate

The stakeholder selected a **MEGA-like paid joining E-PIN model** without mandatory automated email verification. This records **requested future behavior**, not authorization to sell access, collect funds, issue or redeem prepaid PINs, enroll paid members or operate compensation.

**No-Go until all approvals:** retain SRS FR-033/034 exclusions, all paid endpoints and functionality unimplemented and disabled. Staff-reviewed, nonfinancial member applications and admin-assisted one-time password recovery remain separate. No changes to `main`, applied migrations or production.

A **signed legal opinion** from qualified counsel must determine whether the actual entity, consideration, benefits and referral arrangement may legally operate. A developer, project sponsor or software sign-off cannot substitute for that opinion. If recruitment-linked payouts or entry/subscription fees are prohibited for this activity, remove them rather than renaming them E-PINs.

## 2. Evidence we have vs. evidence we need

| Item | Status from supplied SRS/source | Owner / required evidence |
|---|---|---|
| Foundation registered legal name, category and authorizing documents | Unverified | Trustee: government registration, constitutive documents and lawful activity objects |
| Exact consideration / ₹15,000 joining | Stakeholder flyer claim, not approved price | Product + finance: price, taxes, actual separately valuable deliverables |
| Member benefit / goods or services | Not specified | Product + trustee: deliverables, fulfilment evidence and independent value |
| 1:3 matrix and ₹1,000 referral | Unverified claims | Counsel: explicit admissibility/illegality decision; finance: source-of-funds analysis |
| Five levels and rebirth IDs | Unverified; 3+9+27+81+243 = 363 positions | Counsel and finance: prohibit or separately substantiate every condition and liability |
| Refund, cancellations, disputes | Not approved | Legal + product + finance: written policy, consumer disclosures and operator procedure |
| Payment gateway and receiving entity | Not selected/verified | Finance: merchant of record, entity bank/KYC, provider agreement and reconciliation |
| E-PIN issue, custody, expiry, reversals | Not specified | Product + security: credential ownership, operations, abuse rules |
| Email verification | Stakeholder does not want it mandatory | Security: alternative identity/credential recovery and risk acceptance |
| Applicable privacy notices and consent | Pending | Privacy counsel + trustee: purpose, retention, rights, breach response |

**Do not copy MegaMitra's paid enrollment, installment, draw token, sponsor or binary genealogy models.** Nisvartha's proposed 1:3 programme is materially different and remains withheld.

## 3. Questions counsel must answer in writing (approve / reject / redesign)

1. What is the legal form and permitted purpose of Nisvartha Foundation? Can this entity charge money for the stated service, and on what basis?
2. Is the actual proposed activity direct selling, paid membership, charitable donation, or another regulated activity? The answer must be grounded in **real deliverables, promotion, contracts, sales flow and funding**—not the proposed name.
3. Does the ₹15,000 charge amount to an entry/subscription fee, and is it permissible for the chosen activity?
4. Does a participant receive money or benefit merely for recruiting/placing subsequent participants? Are any payouts funded directly or indirectly by joining charges?
5. Are the 1:3 forced-matrix levels, ₹1,000 referrals, “rebirth IDs,” income illustrations or other compensation elements prohibited? If so, record **REJECT / REMOVE** with no implementation.
6. Do any electronic prepaid voucher, stored-value or payment-instrument rules apply to E-PIN issuance/redemption or transferability?
7. Which consumer protection, direct-selling, fundraising, trust/society/Section 8, GST/invoice, accounting, tax, privacy and cancellation/dispute rules apply to the entity and transactions?
8. What explicit pre-purchase disclosures, beneficiary rights, price/tax breakdown, contact/grievance information and refund policy are required?
9. Can staff issue a one-time activation credential after a **verified settled** payment, provided the credential creates only a pending application, without an automatic entitlement?
10. What evidence, review cadence and post-launch monitoring are mandatory? What change requires renewed legal review?

**Counsel determination:**  
- [ ] Proposed paid E-PIN membership permissible **as precisely specified**, with conditions attached  
- [ ] Only redesigned **goods/services sale independent of recruitment** may be considered (specify lawful price/product; not automatically approved)  
- [ ] Not permissible — prohibit paid flow and financial compensation  
- [ ] Insufficient evidence — continue HOLD

**Counsel name/registration, signed opinion reference, date, version of reviewed programme, conditions and next review date:** [to be supplied by counsel]

## 4. Commercial decisions for trustee and finance — no assumed answers

- **Offer ID and real product/service:** [not approved]
- **Independent deliverables, proof and schedule:** [not approved]
- **Price, currency, GST/tax, invoice type:** [not approved; ₹15,000 is only a flyer claim]
- **Merchant of record / approved provider and receiving bank:** [not approved]
- **Eligibility and identity validation:** [not approved]
- **Cancellation and refund windows, full/partial refund, chargeback handling:** [not approved]
- **E-PIN issuance role, beneficiary binding, transferability, expiry, loss/reissue/revocation:** [not approved]
- **Membership status after paid redemption:** default proposed `PENDING` application; independent staff `APPROVED` needed for member privileges
- **No automated email verification:** accepted preference; alternative identity/recovery policy needed
- **Financial rewards/referrals/matrix:** **HOLD**; not implicitly included in approval of a paid membership offer

**Trustee approval signature/reference/date:** [unapproved]  
**Product approval signature/reference/date:** [unapproved]  
**Finance approval signature/reference/date:** [unapproved]  
**Security/privacy approval signature/reference/date:** [unapproved]  
**Legal counsel approval reference/date:** [unapproved]

## 5. Conditional engineering contract — design only; no schema/migration yet

Only once counsel and owners approve a **lawful** paid product:

1. **Offer:** versioned immutable approved description, amount/tax, fulfilment and cancellation policy.
2. **Order:** immutable amount/currency/offer snapshot and unique idempotency key. Initiated/pending orders are not “paid.”
3. **Authoritative payment:** payment attempt and independently verified, reconciled provider settlement with signature checks, deduplication and provider-event history; only a settled approved order can qualify for a prepaid credential. Do not trust UI redirect/webhook claims in isolation.
4. **E-PIN:** cryptographically random, hash at rest, purpose- and offer-bound, assigned to verified holder, with expiry and revoke/reissue governance. No raw PIN in logs, URLs, exported reports or audits.
5. **Atomic redemption:** lock PIN and authoritative order/application records in MySQL; validate current settled eligibility; perform one-use redemption and `MemberAccount(PENDING)` + `MembershipApplication(SUBMITTED)` creation plus audit in a single transaction. Same PIN concurrent callers must not create two accounts or double-consume a payment.
6. **Human membership decision:** existing staff RBAC / review workflow remains sole approval authority. A paid PIN never implies verified identity, entitlement to earnings, sponsor placement, wallet or payout.
7. **Refund/chargeback:** compensating authoritative records, audit/reconciliation and policy-controlled benefit suspension; never quietly delete a settled payment, redemption or history. Sensitive financial actions require review/separation of duties.
8. **Operations:** backups/restore, runbooks, settlement reconciliation, monitoring, alerting, rollback and independent production go-live approval.

### Required regression tests after signed scope
- Issuance denied without approved offer / actual settlement / authorized staff; replayed webhook rejected.
- Concurrent single-PIN redemption: exactly one commit, one account/application and one audit event; deterministic duplicate response.
- Duplicate external references and idempotency keys; crash/retry between settlement and issuance.
- Expired/revoked/wrong-purpose/wrong-holder PIN; rate limiting; enumeration prevention; RBAC, CSRF and session isolation.
- Refund and chargeback before and after redemption; reconciliation, discrepancy alert, immutable history.
- Explicit denial of referral/matrix/wallet/payout functionality unless each independently scoped and legally approved.
- Existing password recovery continues to reject paid activation PIN.
- Verify clean migrations on isolated MySQL 8.4, all unit/integration/concurrency/UAT, compiled API readiness, Next.js route smoke, backup/restore, exact-head GitHub CI and root `npm run verify`; human UAT plus final diff review.

**Hard-coded activation amount, magic PIN states, client-side settlement authority and self-declared legal approval are not acceptable.**

## 6. Reference reading (not legal opinion)

- Government PIB, 28 December 2021: summary of Consumer Protection (Direct Selling) Rules, including bans on pyramid/money-circulation schemes and entry/subscription fees:
  https://www.pib.gov.in/Pressreleaseshare.aspx?PRID=1785873
- Government Gazette, G.S.R. 454(E), 21 June 2023: network-of-sellers amendment, consideration solely from sale of goods/services:
  https://egazette.gov.in/WriteReadData/2023/246732.pdf
- India Code: Prize Chits and Money Circulation Schemes (Banning) Act, 1978:
  https://www.indiacode.nic.in/bitstream/123456789/1628/1/197843.pdf

These references flag questions for counsel, not an assertion that a particular business model is permitted or prohibited without individualized review.

## 7. Implementation release gate checklist

- [ ] Signed legal opinion attached by exact document reference and version
- [ ] Registered entity and authority validated
- [ ] Lawful real product/benefits and membership offer approved
- [ ] Written financial policy, refund/tax/provider/settlement design approved
- [ ] Written privacy and identity/recovery policy approved
- [ ] Signed FR-029–034 SRS change control with approved feature boundary
- [ ] Approved dedicated implementation branch and append-only migration plan
- [ ] Scope gate deliberately revised **with equivalent financial acceptance tests**, never simply removed
- [ ] Backend/frontend exact-head CI + independent local root `npm run verify` + human UAT passed
- [ ] Production deployment separately authorized after rollback/restore verification

**Until every applicable gate is satisfied: no financial schema, paid E-PIN issuance/redemption, payment endpoint, referral/compensation engine or live activation.**
