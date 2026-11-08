-- Append-only. Offline sale confirmation, earned/settled ledger and rebirth matrix entries.
ALTER TABLE matrix_positions
 DROP INDEX matrix_positions_memberId_key,
 ADD COLUMN entryKey VARCHAR(120) NULL AFTER sequence,
 ADD COLUMN kind ENUM('ORIGINAL','REBIRTH') NOT NULL DEFAULT 'ORIGINAL' AFTER slot,
 ADD COLUMN sourcePositionId CHAR(36) NULL AFTER kind,
 ADD COLUMN triggerLevel TINYINT NULL AFTER sourcePositionId,
 ADD COLUMN rebirthOrdinal TINYINT NULL AFTER triggerLevel,
 ADD COLUMN completedAt DATETIME(3) NULL AFTER rebirthOrdinal;

UPDATE matrix_positions SET entryKey=CONCAT('ORIGINAL:',memberId) WHERE entryKey IS NULL;
ALTER TABLE matrix_positions MODIFY entryKey VARCHAR(120) NOT NULL;
ALTER TABLE matrix_positions
 ADD UNIQUE KEY matrix_positions_entryKey_key(entryKey),
 ADD KEY matrix_positions_memberId_createdAt_idx(memberId,createdAt),
 ADD KEY matrix_positions_sourcePositionId_triggerLevel_idx(sourcePositionId,triggerLevel),
 ADD CONSTRAINT matrix_positions_sourcePositionId_fkey
  FOREIGN KEY(sourcePositionId) REFERENCES matrix_positions(id) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE member_offline_sales (
 id CHAR(36) NOT NULL,
 memberId CHAR(36) NOT NULL,
 registrationPinId CHAR(36) NOT NULL,
 requestKey CHAR(36) NOT NULL,
 reference VARCHAR(80) NOT NULL,
 amountPaise INT NOT NULL,
 receivedAt DATETIME(3) NOT NULL,
 evidenceRef VARCHAR(120) NOT NULL,
 confirmedById CHAR(36) NOT NULL,
 createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(id),
 UNIQUE KEY member_offline_sales_memberId_key(memberId),
 UNIQUE KEY member_offline_sales_registrationPinId_key(registrationPinId),
 UNIQUE KEY member_offline_sales_requestKey_key(requestKey),
 UNIQUE KEY member_offline_sales_reference_key(reference),
 KEY member_offline_sales_confirmedById_createdAt_idx(confirmedById,createdAt),
 CONSTRAINT member_offline_sales_memberId_fkey FOREIGN KEY(memberId) REFERENCES member_accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT member_offline_sales_registrationPinId_fkey FOREIGN KEY(registrationPinId) REFERENCES registration_pins(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT member_offline_sales_confirmedById_fkey FOREIGN KEY(confirmedById) REFERENCES staff_users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT member_offline_sales_amount CHECK (amountPaise = 1500000)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE member_earnings (
 id CHAR(36) NOT NULL,
 earningKey VARCHAR(120) NOT NULL,
 kind ENUM('DIRECT_REFERRAL','MATRIX_LEVEL_1','MATRIX_LEVEL_2','MATRIX_LEVEL_3','MATRIX_LEVEL_4','MATRIX_LEVEL_5') NOT NULL,
 level TINYINT NULL,
 beneficiaryMemberId CHAR(36) NOT NULL,
 sourceMemberId CHAR(36) NULL,
 sourcePositionId CHAR(36) NULL,
 amountPaise INT NOT NULL,
 status ENUM('EARNED','SETTLED') NOT NULL DEFAULT 'EARNED',
 createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 settlementRequestKey CHAR(36) NULL,
 settlementReference VARCHAR(80) NULL,
 settlementEvidenceRef VARCHAR(120) NULL,
 settledAt DATETIME(3) NULL,
 settledById CHAR(36) NULL,
 PRIMARY KEY(id),
 UNIQUE KEY member_earnings_earningKey_key(earningKey),
 UNIQUE KEY member_earnings_settlementRequestKey_key(settlementRequestKey),
 KEY member_earnings_beneficiary_status_created_idx(beneficiaryMemberId,status,createdAt),
 KEY member_earnings_sourceMember_created_idx(sourceMemberId,createdAt),
 KEY member_earnings_sourcePosition_created_idx(sourcePositionId,createdAt),
 KEY member_earnings_settledById_idx(settledById),
 CONSTRAINT member_earnings_beneficiary_fkey FOREIGN KEY(beneficiaryMemberId) REFERENCES member_accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT member_earnings_sourceMember_fkey FOREIGN KEY(sourceMemberId) REFERENCES member_accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT member_earnings_sourcePosition_fkey FOREIGN KEY(sourcePositionId) REFERENCES matrix_positions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT member_earnings_settledBy_fkey FOREIGN KEY(settledById) REFERENCES staff_users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT member_earnings_positive CHECK (amountPaise > 0),
 CONSTRAINT member_earnings_settlement_complete CHECK (
  (status='EARNED' AND settlementRequestKey IS NULL AND settlementReference IS NULL AND settlementEvidenceRef IS NULL AND settledAt IS NULL AND settledById IS NULL)
  OR (status='SETTLED' AND settlementRequestKey IS NOT NULL AND settlementReference IS NOT NULL AND settlementEvidenceRef IS NOT NULL AND settledAt IS NOT NULL AND settledById IS NOT NULL)
 )
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
