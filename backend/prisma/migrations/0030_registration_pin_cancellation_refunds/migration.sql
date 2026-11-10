-- A verified, externally completed refund is independent of E-PIN cancellation.
-- Never infer that an earlier no-fee registration PIN represented received cash.
-- MySQL 8.4 forbids FK columns inside CHECK expressions: the FK itself
-- guards staff IDs; the CHECK only covers local cancellation state.
ALTER TABLE `registration_pins`
 ADD COLUMN `cancelledAt` DATETIME(3) NULL,
 ADD COLUMN `cancelledById` CHAR(36) NULL,
 ADD COLUMN `cancellationReason` VARCHAR(500) NULL,
 ADD COLUMN `cancelRequestKey` CHAR(36) NULL,
 ADD UNIQUE KEY `registration_pins_cancelRequestKey_key` (`cancelRequestKey`),
 ADD CONSTRAINT `registration_pins_cancelledById_fkey`
  FOREIGN KEY (`cancelledById`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 ADD CONSTRAINT `registration_pins_cancel_consistent` CHECK (
  (`cancelledAt` IS NULL AND `cancelRequestKey` IS NULL AND `cancellationReason` IS NULL)
  OR
  (`cancelledAt` IS NOT NULL AND `cancelRequestKey` IS NOT NULL AND `cancellationReason` IS NOT NULL
   AND `redeemedAt` IS NULL)
 );

CREATE TABLE `registration_pin_refunds` (
 `id` CHAR(36) NOT NULL,
 `pinId` CHAR(36) NOT NULL,
 `requestKey` CHAR(36) NOT NULL,
 `bankReference` VARCHAR(80) NOT NULL,
 `evidenceRef` VARCHAR(120) NOT NULL,
 `paidAt` DATETIME(3) NOT NULL,
 `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 `recordedById` CHAR(36) NOT NULL,
 PRIMARY KEY (`id`),
 UNIQUE KEY `registration_pin_refunds_pinId_key` (`pinId`),
 UNIQUE KEY `registration_pin_refunds_requestKey_key` (`requestKey`),
 UNIQUE KEY `registration_pin_refunds_bankReference_key` (`bankReference`),
 CONSTRAINT `registration_pin_refunds_pinId_fkey` FOREIGN KEY (`pinId`)
  REFERENCES `registration_pins`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `registration_pin_refunds_recordedById_fkey` FOREIGN KEY (`recordedById`)
  REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
