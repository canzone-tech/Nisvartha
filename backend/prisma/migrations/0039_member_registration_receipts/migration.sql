-- Append-only member registration receipt numbering. Do not use donation receipts:
-- one immutable receipt per genuinely funded member, with an auto-incremented
-- 5-digit (minimum display width) reference and unique payment provenance.
CREATE TABLE `member_registration_receipts` (
 `receiptNo` INTEGER NOT NULL AUTO_INCREMENT,
 `memberId` CHAR(36) NOT NULL,
 `sourceKind` ENUM('VERIFIED_PAID_PIN','VERIFIED_OFFLINE_SALE') NOT NULL,
 `sourceId` CHAR(36) NOT NULL,
 `amountPaise` INTEGER NOT NULL,
 `receivedAt` DATETIME(3) NOT NULL,
 `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE INDEX `member_registration_receipts_memberId_key`(`memberId`),
 UNIQUE INDEX `member_registration_receipts_sourceKind_sourceId_key`(`sourceKind`,`sourceId`),
 INDEX `member_registration_receipts_receivedAt_receiptNo_idx`(`receivedAt`,`receiptNo`),
 PRIMARY KEY (`receiptNo`),
 CONSTRAINT `member_registration_receipts_memberId_fkey`
  FOREIGN KEY (`memberId`) REFERENCES `member_accounts`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `member_registration_receipts_positive_amount` CHECK (`amountPaise` > 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- The existing authoritative receipts are backfilled by actual funding time;
-- free/legacy E-PINs, unconsumed paid PINs and unverified registrations are
-- intentionally excluded. Any inconsistent double-funded member causes a
-- UNIQUE failure instead of silently inventing or duplicating a receipt.
INSERT INTO `member_registration_receipts`
 (`memberId`,`sourceKind`,`sourceId`,`amountPaise`,`receivedAt`)
SELECT verified.`memberId`,verified.`sourceKind`,verified.`sourceId`,
 verified.`amountPaise`,verified.`receivedAt`
FROM (
 SELECT r.`memberId` AS `memberId`, 'VERIFIED_PAID_PIN' AS `sourceKind`,
  r.`pinId` AS `sourceId`,r.`amountPaise` AS `amountPaise`,
  paid.`receivedAt` AS `receivedAt`
 FROM `registration_pin_paid_redemptions` r
 INNER JOIN `registration_pins` pin ON pin.`id`=r.`pinId`
 INNER JOIN `registration_pin_paid_batches` paid ON paid.`batchId`=pin.`batchId`
 UNION ALL
 SELECT s.`memberId` AS `memberId`, 'VERIFIED_OFFLINE_SALE' AS `sourceKind`,
  s.`id` AS `sourceId`,s.`amountPaise` AS `amountPaise`,s.`receivedAt` AS `receivedAt`
 FROM `member_offline_sales` s
) verified
ORDER BY verified.`receivedAt`,verified.`memberId`,verified.`sourceKind`;
