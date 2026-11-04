-- Synthetic, nonfinancial signup PIN redemption and one-level inviter attribution.
-- User approval is for UAT; paid E-PIN issuance, money and commissions remain HOLD.
ALTER TABLE `member_accounts`
 ADD COLUMN `referralCode` VARCHAR(22) NULL;

CREATE UNIQUE INDEX `member_accounts_referralCode_key`
 ON `member_accounts`(`referralCode`);

CREATE TABLE `uat_signup_pin_batches` (
 `id` CHAR(36) NOT NULL,
 `requestKey` CHAR(36) NOT NULL,
 `issuerId` CHAR(36) NOT NULL,
 `quantity` INT NOT NULL,
 `expiresAt` DATETIME(3) NOT NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (`id`),
 UNIQUE KEY `uat_signup_pin_batches_requestKey_key` (`requestKey`),
 KEY `uat_signup_pin_batches_issuerId_createdAt_idx` (`issuerId`, `createdAt`),
 CONSTRAINT `uat_signup_pin_batches_issuerId_fkey` FOREIGN KEY (`issuerId`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `uat_signup_pins` (
 `id` CHAR(36) NOT NULL,
 `batchId` CHAR(36) NOT NULL,
 `tokenHash` CHAR(64) NOT NULL,
 `displaySuffix` CHAR(6) NOT NULL,
 `expiresAt` DATETIME(3) NOT NULL,
 `redeemedAt` DATETIME(3) NULL,
 `redeemedByMemberId` CHAR(36) NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (`id`),
 UNIQUE KEY `uat_signup_pins_tokenHash_key` (`tokenHash`),
 UNIQUE KEY `uat_signup_pins_redeemedByMemberId_key` (`redeemedByMemberId`),
 KEY `uat_signup_pins_expiresAt_redeemedAt_idx` (`expiresAt`, `redeemedAt`),
 KEY `uat_signup_pins_batchId_fkey` (`batchId`),
 CONSTRAINT `uat_signup_pins_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `uat_signup_pin_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `uat_signup_pins_redeemedByMemberId_fkey` FOREIGN KEY (`redeemedByMemberId`) REFERENCES `member_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `member_invitations` (
 `id` CHAR(36) NOT NULL,
 `inviterId` CHAR(36) NOT NULL,
 `inviteeId` CHAR(36) NOT NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (`id`),
 UNIQUE KEY `member_invitations_inviteeId_key` (`inviteeId`),
 KEY `member_invitations_inviterId_createdAt_idx` (`inviterId`, `createdAt`),
 CONSTRAINT `member_invitations_inviterId_fkey` FOREIGN KEY (`inviterId`) REFERENCES `member_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `member_invitations_inviteeId_fkey` FOREIGN KEY (`inviteeId`) REFERENCES `member_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
