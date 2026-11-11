-- Each paid receipt is allocated once to a redeemed registration PIN/member.
-- Legacy PINs and historical unaudited rows are never automatically backfilled.
-- These allocations are fee provenance, NOT sale/commission/payout funding.
CREATE TABLE `registration_pin_paid_redemptions` (
 `pinId` CHAR(36) NOT NULL,
 `memberId` CHAR(36) NOT NULL,
 `amountPaise` INT NOT NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (`pinId`),
 UNIQUE KEY `registration_pin_paid_redemptions_memberId_key` (`memberId`),
 KEY `registration_pin_paid_redemptions_createdAt_idx` (`createdAt`),
 CONSTRAINT `registration_pin_paid_redemptions_pinId_fkey`
  FOREIGN KEY (`pinId`) REFERENCES `registration_pins`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `registration_pin_paid_redemptions_memberId_fkey`
  FOREIGN KEY (`memberId`) REFERENCES `member_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `registration_pin_paid_redemptions_amount_check`
  CHECK (`amountPaise` = 1500000)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
