-- Q37-A: only NEW, explicitly Admin-verified offline amounts create paid
-- accounting provenance. Prior registration PIN batches remain legacy and
-- are never backfilled, inferred, or classified as ₹15,000 receipts.
-- One external bank reference can evidence one batch containing 1-50 PINs.
CREATE TABLE `registration_pin_paid_batches` (
 `batchId` CHAR(36) NOT NULL,
 `bankReference` VARCHAR(80) NOT NULL,
 `evidenceRef` VARCHAR(120) NOT NULL,
 `verifiedAmountPaise` INT NOT NULL,
 `unitAmountPaise` INT NOT NULL,
 `receivedAt` DATETIME(3) NOT NULL,
 `verifiedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 `verifiedById` CHAR(36) NOT NULL,
 PRIMARY KEY (`batchId`),
 UNIQUE KEY `registration_pin_paid_batches_bankReference_key` (`bankReference`),
 KEY `registration_pin_paid_batches_verifiedAt_idx` (`verifiedAt`),
 CONSTRAINT `registration_pin_paid_batches_batchId_fkey` FOREIGN KEY (`batchId`)
  REFERENCES `registration_pin_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `registration_pin_paid_batches_verifiedById_fkey` FOREIGN KEY (`verifiedById`)
  REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `registration_pin_paid_batches_unit_check` CHECK (`unitAmountPaise` = 1500000),
 CONSTRAINT `registration_pin_paid_batches_total_check`
  CHECK (`verifiedAmountPaise` BETWEEN 1500000 AND 75000000
   AND MOD(`verifiedAmountPaise`,1500000)=0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Registry is shared with offline payouts, earning settlements and refunds.
ALTER TABLE `financial_settlement_references`
 MODIFY COLUMN `sourceKind` ENUM('EARNING','PAYOUT','PIN_REFUND','PIN_PAYMENT') NOT NULL;
