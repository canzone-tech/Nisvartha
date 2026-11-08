-- Separate durable, no-fee registration access credentials from synthetic UAT.
-- No payment, issuance sale, commission, activation or wallet records.
CREATE TABLE `registration_pin_batches` (
 `id` CHAR(36) NOT NULL,
 `requestKey` CHAR(36) NOT NULL,
 `issuerId` CHAR(36) NOT NULL,
 `quantity` INT NOT NULL,
 `expiresAt` DATETIME(3) NOT NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (`id`),
 UNIQUE KEY `registration_pin_batches_requestKey_key` (`requestKey`),
 KEY `registration_pin_batches_issuerId_createdAt_idx` (`issuerId`,`createdAt`),
 CONSTRAINT `registration_pin_batches_issuerId_fkey` FOREIGN KEY (`issuerId`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `registration_pins` (
 `id` CHAR(36) NOT NULL,
 `batchId` CHAR(36) NOT NULL,
 `tokenHash` CHAR(64) NOT NULL,
 `displaySuffix` CHAR(6) NOT NULL,
 `expiresAt` DATETIME(3) NOT NULL,
 `redeemedAt` DATETIME(3) NULL,
 `redeemedByMemberId` CHAR(36) NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (`id`),
 UNIQUE KEY `registration_pins_tokenHash_key` (`tokenHash`),
 UNIQUE KEY `registration_pins_redeemedByMemberId_key` (`redeemedByMemberId`),
 KEY `registration_pins_expiresAt_redeemedAt_idx` (`expiresAt`,`redeemedAt`),
 KEY `registration_pins_batchId_fkey` (`batchId`),
 CONSTRAINT `registration_pins_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `registration_pin_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `registration_pins_redeemedByMemberId_fkey` FOREIGN KEY (`redeemedByMemberId`) REFERENCES `member_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
