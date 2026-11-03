-- FR-029..031 nonfinancial member identities and membership applications.
-- This migration intentionally contains NO E-PIN, payment, matrix, reward or wallet tables.
CREATE TABLE `member_accounts` (
 `id` CHAR(36) NOT NULL, `email` VARCHAR(191) NOT NULL,
 `displayName` VARCHAR(120) NOT NULL, `passwordHash` VARCHAR(255) NOT NULL,
 `status` ENUM('PENDING','ACTIVE','SUSPENDED','DISABLED') NOT NULL DEFAULT 'PENDING',
 `communicationOptIn` BOOLEAN NOT NULL DEFAULT FALSE,
 `failedLogins` INTEGER NOT NULL DEFAULT 0,
 `lockedUntil` DATETIME(3) NULL, `lastLoginAt` DATETIME(3) NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 `updatedAt` DATETIME(3) NOT NULL,
 UNIQUE INDEX `member_accounts_email_key`(`email`),
 PRIMARY KEY(`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `member_sessions` (
 `id` CHAR(36) NOT NULL, `memberId` CHAR(36) NOT NULL,
 `tokenHash` CHAR(64) NOT NULL, `expiresAt` DATETIME(3) NOT NULL,
 `revokedAt` DATETIME(3) NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE INDEX `member_sessions_tokenHash_key`(`tokenHash`),
 INDEX `member_sessions_memberId_expiresAt_idx`(`memberId`,`expiresAt`),
 PRIMARY KEY(`id`),
 CONSTRAINT `member_sessions_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `member_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `membership_applications` (
 `id` CHAR(36) NOT NULL, `memberId` CHAR(36) NOT NULL,
 `status` ENUM('SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','SUSPENDED','WITHDRAWN') NOT NULL DEFAULT 'SUBMITTED',
 `termsVersion` VARCHAR(50) NOT NULL, `privacyVersion` VARCHAR(50) NOT NULL,
 `consentAt` DATETIME(3) NOT NULL, `reviewerId` CHAR(36) NULL,
 `reviewedAt` DATETIME(3) NULL, `decisionReason` VARCHAR(1000) NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 `updatedAt` DATETIME(3) NOT NULL,
 UNIQUE INDEX `membership_applications_memberId_key`(`memberId`),
 INDEX `membership_applications_status_createdAt_idx`(`status`,`createdAt`),
 PRIMARY KEY(`id`),
 CONSTRAINT `membership_applications_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `member_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `membership_applications_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `member_audit` (
 `id` CHAR(36) NOT NULL, `memberId` CHAR(36) NOT NULL,
 `action` VARCHAR(60) NOT NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX `member_audit_memberId_createdAt_idx`(`memberId`,`createdAt`),
 PRIMARY KEY(`id`),
 CONSTRAINT `member_audit_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `member_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
