-- FR-029: one-time, staff-verified member credential recovery.
-- No plaintext codes, payment logic, E-PIN issuance, referral or compensation.
CREATE TABLE `member_password_recoveries` (
 `id` CHAR(36) NOT NULL,
 `memberId` CHAR(36) NOT NULL,
 `issuerId` CHAR(36) NOT NULL,
 `tokenHash` CHAR(64) NOT NULL,
 `identityEvidenceRef` VARCHAR(120) NOT NULL,
 `expiresAt` DATETIME(3) NOT NULL,
 `usedAt` DATETIME(3) NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE INDEX `member_password_recoveries_tokenHash_key` (`tokenHash`),
 INDEX `member_password_recoveries_memberId_expiresAt_idx` (`memberId`,`expiresAt`),
 PRIMARY KEY (`id`),
 CONSTRAINT `member_password_recoveries_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `member_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `member_password_recoveries_issuerId_fkey` FOREIGN KEY (`issuerId`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
