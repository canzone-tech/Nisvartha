CREATE TABLE donation_receipts (
 id CHAR(36) NOT NULL, requestKey CHAR(36) NOT NULL,
 bankReference VARCHAR(80) NOT NULL, amountPaise INT NOT NULL,
 receivedAt DATETIME(3) NOT NULL, evidenceRef VARCHAR(120) NOT NULL,
 status ENUM('PENDING','RECONCILED','REJECTED') NOT NULL DEFAULT 'PENDING',
 recordedById CHAR(36) NOT NULL,
 createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updatedAt DATETIME(3) NOT NULL,
 PRIMARY KEY(id), UNIQUE KEY donation_receipts_requestKey_key(requestKey),
 UNIQUE KEY donation_receipts_bankReference_key(bankReference),
 KEY donation_receipts_status_createdAt_idx(status,createdAt),
 KEY donation_receipts_recordedById_fkey(recordedById),
 CONSTRAINT donation_receipts_recordedById_fkey FOREIGN KEY(recordedById) REFERENCES staff_users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT donation_amount_positive CHECK(amountPaise>0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE donation_events (
 id CHAR(36) NOT NULL, requestKey CHAR(36) NOT NULL,
 receiptId CHAR(36) NOT NULL, kind ENUM('RECORDED','RECONCILED','REJECTED') NOT NULL,
 actorId CHAR(36) NOT NULL, evidenceRef VARCHAR(120) NOT NULL,
 createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(id), UNIQUE KEY donation_events_requestKey_key(requestKey),
 KEY donation_events_receiptId_createdAt_idx(receiptId,createdAt),
 KEY donation_events_actorId_fkey(actorId),
 CONSTRAINT donation_events_receiptId_fkey FOREIGN KEY(receiptId) REFERENCES donation_receipts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT donation_events_actorId_fkey FOREIGN KEY(actorId) REFERENCES staff_users(id) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
