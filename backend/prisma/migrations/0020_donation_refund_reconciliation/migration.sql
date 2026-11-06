-- Append-only. Stand-alone donation refund evidence, no enrollment or recruitment.
CREATE TABLE donation_refunds (
 id CHAR(36) NOT NULL, receiptId CHAR(36) NOT NULL,
 requestKey CHAR(36) NOT NULL, bankReference VARCHAR(80) NOT NULL,
 amountPaise INT NOT NULL, evidenceRef VARCHAR(120) NOT NULL,
 status ENUM('PENDING','CONFIRMED','REJECTED') NOT NULL DEFAULT 'PENDING',
 createdById CHAR(36) NOT NULL,
 reviewRequestKey CHAR(36) NULL, reviewEvidenceRef VARCHAR(120) NULL,
 reviewedAt DATETIME(3) NULL, createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(id),
 UNIQUE KEY donation_refunds_requestKey_key(requestKey),
 UNIQUE KEY donation_refunds_bankReference_key(bankReference),
 UNIQUE KEY donation_refunds_reviewRequestKey_key(reviewRequestKey),
 KEY donation_refunds_receiptId_status_idx(receiptId,status),
 KEY donation_refunds_status_createdAt_idx(status,createdAt),
 KEY donation_refunds_createdById_fkey(createdById),
 CONSTRAINT donation_refunds_receiptId_fkey FOREIGN KEY(receiptId) REFERENCES donation_receipts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT donation_refunds_createdById_fkey FOREIGN KEY(createdById) REFERENCES staff_users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT donation_refunds_positive CHECK (amountPaise > 0),
 CONSTRAINT donation_refunds_review_complete CHECK (
 (status='PENDING' AND reviewRequestKey IS NULL AND reviewEvidenceRef IS NULL AND reviewedAt IS NULL)
 OR (status<>'PENDING' AND reviewRequestKey IS NOT NULL AND reviewEvidenceRef IS NOT NULL AND reviewedAt IS NOT NULL))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE donation_refund_events (
 id CHAR(36) NOT NULL, requestKey CHAR(36) NOT NULL,
 refundId CHAR(36) NOT NULL,
 kind ENUM('REQUESTED','CONFIRMED','REJECTED') NOT NULL,
 actorId CHAR(36) NOT NULL, evidenceRef VARCHAR(120) NOT NULL,
 createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(id), UNIQUE KEY donation_refund_events_requestKey_key(requestKey),
 KEY donation_refund_events_refundId_createdAt_idx(refundId,createdAt),
 KEY donation_refund_events_actorId_fkey(actorId),
 CONSTRAINT donation_refund_events_refundId_fkey FOREIGN KEY(refundId) REFERENCES donation_refunds(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT donation_refund_events_actorId_fkey FOREIGN KEY(actorId) REFERENCES staff_users(id) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
