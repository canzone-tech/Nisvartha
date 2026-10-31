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
| FR-019 CMS edit/draft/preview | P1 | Not implemented; avoid premature CMS tables |
| FR-020 CMS approval/publish | P1 | Not implemented; publication approval must be authenticated and audited |
| FR-021 Media library | P1 | Not implemented; licensing/storage/malware validation needed |
| FR-022 News/events CMS | P1 | Public approved-only read model exists; editing/archive workflow pending |
| FR-023 Gallery CMS | P1 | Content/media consent workflow pending |
| FR-024 Admin/RBAC | P1 | Not implemented; interim operator read-only CLI is NOT RBAC/admin |
| FR-025 Audit log | P1 | Not implemented; operator CLI does not audit individual reads |
| FR-026 Enquiry management | P1 | Read-only CLI P0 interim; assign/status/notes/export require authenticated admin |
| FR-027 Retention | P1 | No automated archiving/deletion yet; legal hold/retention policy pending |
| FR-028 Dashboard | P1 | Not implemented |
| FR-029–FR-032 Member services | P2 | Separate specification and role/security approval required |
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
6. Implement P1 CMS as a separate approved development phase; P2 member/financial workflows require new detailed approval. **Do not represent P0-only verification as all-FR completion.**

No production deployment or production database migration is authorized by this file.
