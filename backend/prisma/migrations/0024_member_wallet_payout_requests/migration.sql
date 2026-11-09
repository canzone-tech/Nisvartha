-- M6 append-only. Member-level payout reservations and an immutable shared
-- external settlement reference namespace. Does not enable live transfers.
CREATE TABLE member_payout_requests (
 id CHAR(36) NOT NULL,
 memberId CHAR(36) NOT NULL,
 requestKey CHAR(36) NOT NULL,
 amountPaise INT NOT NULL,
 status ENUM('REQUESTED','PAID','REJECTED') NOT NULL DEFAULT 'REQUESTED',
 createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 decisionRequestKey CHAR(36) NULL,
 decidedAt DATETIME(3) NULL,
 decidedById CHAR(36) NULL,
 rejectionReason VARCHAR(500) NULL,
 settlementReference VARCHAR(80) NULL,
 settlementEvidenceRef VARCHAR(120) NULL,
 paidAt DATETIME(3) NULL,
 PRIMARY KEY(id),
 UNIQUE KEY member_payout_requests_requestKey_key(requestKey),
 UNIQUE KEY member_payout_requests_decisionRequestKey_key(decisionRequestKey),
 UNIQUE KEY member_payout_requests_settlementReference_key(settlementReference),
 KEY member_payout_requests_memberId_status_created_idx(memberId,status,createdAt),
 KEY member_payout_requests_status_created_idx(status,createdAt),
 KEY member_payout_requests_decidedById_idx(decidedById),
 CONSTRAINT member_payout_requests_memberId_fkey FOREIGN KEY(memberId) REFERENCES member_accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT member_payout_requests_decidedById_fkey FOREIGN KEY(decidedById) REFERENCES staff_users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT member_payout_requests_positive CHECK (amountPaise BETWEEN 100 AND 2000000000),
 CONSTRAINT member_payout_requests_status_evidence CHECK (
  (status='REQUESTED' AND decisionRequestKey IS NULL AND decidedAt IS NULL AND decidedById IS NULL
   AND rejectionReason IS NULL AND settlementReference IS NULL AND settlementEvidenceRef IS NULL AND paidAt IS NULL)
  OR
  (status='PAID' AND decisionRequestKey IS NOT NULL AND decidedAt IS NOT NULL AND decidedById IS NOT NULL
   AND rejectionReason IS NULL AND settlementReference IS NOT NULL AND settlementEvidenceRef IS NOT NULL AND paidAt IS NOT NULL)
  OR
  (status='REJECTED' AND decisionRequestKey IS NOT NULL AND decidedAt IS NOT NULL AND decidedById IS NOT NULL
   AND rejectionReason IS NOT NULL AND settlementReference IS NULL AND settlementEvidenceRef IS NULL AND paidAt IS NULL)
 )
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE financial_settlement_references (
 reference VARCHAR(80) NOT NULL,
 sourceId CHAR(36) NOT NULL,
 sourceKind ENUM('EARNING','PAYOUT') NOT NULL,
 createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(reference),
 UNIQUE KEY financial_settlement_references_sourceId_key(sourceId)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Preserve the existing authoritative offline settlement evidence and prevent
-- later wallet payouts from reusing any prior external transfer reference.
INSERT INTO financial_settlement_references(reference,sourceId,sourceKind)
 SELECT settlementReference,id,'EARNING'
 FROM member_earnings
 WHERE status='SETTLED' AND settlementReference IS NOT NULL;
