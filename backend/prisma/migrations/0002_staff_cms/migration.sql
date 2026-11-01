-- Phase 2 CMS/Admin only. New migration; Phase 1 migration stays immutable.
CREATE TABLE `staff_users` (
 `id` CHAR(36) NOT NULL,
 `email` VARCHAR(191) NOT NULL,
 `displayName` VARCHAR(120) NOT NULL,
 `passwordHash` VARCHAR(255) NOT NULL,
 `role` ENUM('ADMIN','EDITOR','APPROVER','AUDITOR') NOT NULL,
 `status` ENUM('ACTIVE','DISABLED') NOT NULL DEFAULT 'ACTIVE',
 `failedLogins` INTEGER NOT NULL DEFAULT 0,
 `lockedUntil` DATETIME(3) NULL,
 `lastLoginAt` DATETIME(3) NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 `updatedAt` DATETIME(3) NOT NULL,
 UNIQUE INDEX `staff_users_email_key` (`email`),
 PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `staff_sessions` (
 `id` CHAR(36) NOT NULL,
 `staffId` CHAR(36) NOT NULL,
 `tokenHash` CHAR(64) NOT NULL,
 `expiresAt` DATETIME(3) NOT NULL,
 `revokedAt` DATETIME(3) NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE INDEX `staff_sessions_tokenHash_key` (`tokenHash`),
 INDEX `staff_sessions_staffId_expiresAt_idx` (`staffId`,`expiresAt`),
 PRIMARY KEY (`id`),
 CONSTRAINT `staff_sessions_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `cms_content` (
 `id` CHAR(36) NOT NULL,
 `slug` VARCHAR(150) NOT NULL,
 `kind` ENUM('PAGE','ACTIVITY','PROJECT','NEWS','EVENT','FAQ') NOT NULL,
 `publishedRevisionId` CHAR(36) NULL,
 `archivedAt` DATETIME(3) NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 `updatedAt` DATETIME(3) NOT NULL,
 UNIQUE INDEX `cms_content_slug_key` (`slug`),
 INDEX `cms_content_kind_archivedAt_idx` (`kind`,`archivedAt`),
 PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `cms_revisions` (
 `id` CHAR(36) NOT NULL,
 `contentId` CHAR(36) NOT NULL,
 `version` INTEGER NOT NULL,
 `title` VARCHAR(200) NOT NULL,
 `summary` VARCHAR(600) NOT NULL,
 `body` TEXT NOT NULL,
 `status` ENUM('DRAFT','SUBMITTED','APPROVED','REJECTED') NOT NULL DEFAULT 'DRAFT',
 `authorId` CHAR(36) NOT NULL,
 `reviewerId` CHAR(36) NULL,
 `reviewReason` VARCHAR(1000) NULL,
 `publishedAt` DATETIME(3) NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 `updatedAt` DATETIME(3) NOT NULL,
 UNIQUE INDEX `cms_revisions_contentId_version_key` (`contentId`,`version`),
 INDEX `cms_revisions_contentId_status_idx` (`contentId`,`status`),
 PRIMARY KEY (`id`),
 CONSTRAINT `cms_revisions_contentId_fkey` FOREIGN KEY (`contentId`) REFERENCES `cms_content`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `cms_revisions_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `cms_revisions_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `cms_audit` (
 `id` CHAR(36) NOT NULL,
 `actorId` CHAR(36) NOT NULL,
 `action` VARCHAR(90) NOT NULL,
 `objectType` VARCHAR(90) NOT NULL,
 `objectId` VARCHAR(150) NOT NULL,
 `summary` VARCHAR(500) NOT NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX `cms_audit_objectType_objectId_createdAt_idx` (`objectType`,`objectId`,`createdAt`),
 INDEX `cms_audit_actorId_createdAt_idx` (`actorId`,`createdAt`),
 PRIMARY KEY (`id`),
 CONSTRAINT `cms_audit_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
