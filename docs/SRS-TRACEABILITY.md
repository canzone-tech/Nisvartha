# Nisvartha SRS v1.0 acceptance traceability (30 October 2026)

**Source:** `Nisvartha_Foundation_SRS_v1.0.docx`, baseline draft pending authorized sign-off; supplied owner flyer, unverified. A green CI check does **not** mean the Foundation has approved content, financial operations, privacy notices or deployment.

Status definitions: **Implemented/tested** = a scoped technical flow with CI evidence; **Partial** = implementation or validation gap; **Blocked by approval** = code cannot legitimately replace external evidence/sign-off; **P1** = approved after public Phase 1; **P2/gated** = new scope/spec and separate authorization.

| SRS | State | Current implementation / acceptance gap |
|---|---|---|
| FR-001 Navigation | Partial | Responsive shared navigation/footer, keyboard menu and browser smoke; official logo awaits approval |
| FR-002 Homepage | Partial | Mission-led hero, real approved-only project/activity/news sources; approved mission and content not yet supplied |
| FR-003 About | Blocked by approval | Verified registration, governance, contact and leadership content required |
| FR-004 Activities/projects | Partial | Approved-only lists and project detail routes; real records/evidence and media approval outstanding |
| FR-005 Go Green | Partial | Published-campaign list with verified outcomes contract; evidence/media pending |
| FR-006 Contact | Implemented/tested, gated | NestJS validation and MySQL persistence; activate only after privacy/ops clearance |
| FR-007 Volunteer | Implemented/tested, gated | Interests, availability and consent; separate regression tests |
| FR-008 Acknowledgement | Implemented/tested | Unique reference and replay-safe confirmation |
| FR-009 Spam | Partial | Input normalization, honeypot and throttling; monitoring/production controls need deployment acceptance |
| FR-010 Privacy consent | Blocked by approval | Timestamp/version persisted; formal notice and approved retention/controller contact pending |
| FR-011 Donations | Implemented as informational | No collection or banking details; publication of instructions needs legal authorization |
| FR-012 Membership | Blocked by approval | Clearly distinct from donation; fee/eligibility/process/terms awaiting review |
| FR-013 Auto Pool approval gate | Implemented/tested | Direct URL 404 and no indexing of proposed financial content |
| FR-014 No guaranteed returns | Implemented in public content | No published earnings claims; flyer amounts are internal unverified references only |
| FR-015 Verified contact details | Blocked by approval | No unverified address, email, WhatsApp, or contact person publicly asserted |
| FR-016 SEO | Partial | Canonical/OG/Twitter and robots metadata; audit representative devices and approved content |
| FR-017 Sitemap/robots | Implemented, gated | Sitemap excludes unapproved content; crawler exclusion by default |
| FR-018 Accessibility | Partial | Semantic headings, focus and navigation checks; screen reader/WCAG 2.2 AA audit outstanding |
| FR-019 CMS edit/draft/preview | Implemented/tested core | Versioned staff editing and authenticated exact revision preview via /admin/preview/:id; RBAC, read audit, unpublished isolation, noindex, HTML escaping and archived/rejected history verified; formal editorial UAT still required |
| FR-020 CMS approval/publish | Implemented/tested | Independent approver role, submitted/rejected/approved snapshots, audit and archive tested in MySQL; cross-app publication UAT separately verified by CI |
| FR-021 Media library | Implemented core; operational approval pending | Private local image storage, malware scanner gate, sanitization, alt text, and mandatory private rights/consent evidence register IDs on new uploads; approvals fail closed without refs, while production scanner/signature monitoring remains a release gate |
| FR-022 News/events CMS | Implemented/tested core | Event start/end with explicit UTC offset and IANA timezone, physical or HTTPS venue, HTTPS registration link, revision-controlled scheduled/postponed/cancelled/completed state, independent publish/archival; no on-site registration collection |
| FR-023 Gallery CMS | Implemented core; external evidence sign-off pending | Independent publication, archive revocation, evidence references visible only to staff; read-only disk vs MySQL checks detect missing, corrupt or unexpected images; actual consent/register documents and production backup policy still require owner verification |
| FR-024 Admin/RBAC | Implemented/tested core | Argon2id staff account, revocable token sessions, roles and role-gated admin UI/API; production MFA remains a release hardening task |
| FR-025 Audit log | Implemented/tested core | MySQL transactionally persists staff, CMS and enquiry case audit; P0 read-only legacy operator CLI still does not audit separate reads |
| FR-026 Enquiry management | Implemented/tested core | Staff-only case list/detail, assignment, notes, volunteer statuses, admin export and audited reads tested |
| FR-027 Retention | Partial | Approved-only retention runner, legal hold protection and anonymization tested on isolated MySQL; no production schedule, counsel-approved duration or SLA |
| FR-028 Dashboard | Implemented/tested basic | Staff dashboard with drafts, submitted, published and new enquiry totals; broader operational metrics still pending |
| FR-029–FR-032 Member services | Partial, feature-gated | Nonfinancial member registration/login, revocable sessions, profile, password change, application review/approval/withdraw/suspend, audited staff review and gated UI implemented on Phase 3 branch. Staff-assisted, one-time 15-minute password recovery with replay protection, session revocation and identity-evidence audit implemented (separately gated); automated email verification is **not required for the intended E-PIN-based activation** (owner decision 1 Nov 2026). Approved identity/recovery procedure, optional MFA and actual E-PIN eligibility/one-time consumption remain separate work. Current registration is only a PENDING nonfinancial application, not E-PIN activation. No monetary entitlement. |
| FR-033 Payments | P2/gated | Not implemented; provider, reconciliation, refunds and legal approval required |
| FR-034 Matrix/referral/rebirth/wallet/payout | P2/gated | **Not implemented**; separate signed legal and financial specifications required |

## Flyer reconciliation — reference arithmetic only

The supplied flyer depicts a **1:3 fixed forced matrix** with five level team sizes `3, 9, 27, 81, 243`, totaling **363** positions; displayed payouts `₹2,500, ₹5,000, ₹10,000, ₹50,000, ₹90,000`, totaling **₹1,57,500**, plus four illustrated rebirth IDs (one at level 4, three at level 5). It also advertises a ₹15,000 joining amount and ₹1,000 direct referral amount. These **are not validated funding mechanics or promised returns**. The regression gate checks source arithmetic only, not placement, earnings entitlement, payouts or legality. MegaMitra's left/right binary is expressly excluded.

## Required gate before final public UAT/sign-off

1. Authorized Foundation sign-off on legal name, logo, address/contact, governance, vision, mission and approved activities/projects, backed by evidence.
2. Approved privacy policy, terms, controller/data-subject route, consent wording, retention, staff assignments and processing authorization.
3. Production/staging configuration and securely provisioned MySQL; TLS, monitoring, daily encrypted backups, isolated restore, rollback and access controls.
4. Run root `npm run verify` on an isolated development host with Node 22 and Docker Compose; CI runs corresponding web and MySQL/compiled API gates.
5. Conduct human mobile, desktop, keyboard, screen reader, cross-browser and content review; record blocking defects and owner acceptance.
6. Complete P1 CMS media/gallery and operational hardening after current staff/content core, then require independent legal/scope approval for P2 member and financial workflows. **Do not represent P0-only verification as all-FR completion.**

No production deployment or production database migration is authorized by this file.

## Phase 2 implementation reference

Staff/CMS/case work is staged on `dev/phase2-cms-admin`, stacking on the unchanged Phase 1 branch. See [Phase 2 operation gates](PHASE2-OPERATIONS.md) and [MegaMitra reuse boundary](MEGAMITRA-REUSE-BOUNDARY.md). Source-level P1 CI must be verified on the **exact latest branch SHA**, not inferred from earlier runs. Unverified content and financial capabilities remain blocked.

## Phase 3 development boundary

See [nonfinancial membership foundation](PHASE3-MEMBERSHIP-BOUNDARY.md). The 1:3 flyer is descriptive stakeholder material, **not** a signed financial specification. FR-033/034 remain legally and financially gated; do not classify membership status approval as payment, E-PIN activation or commission entitlement.
