-- FR-021/023 image-only gallery. Bytes remain on an operator-owned local persistent volume.
-- Do not change any prior migration. This metadata is the authoritative approval record.
CREATE TABLE `cms_media` (
 `id` CHAR(36) NOT NULL,
 `fileKey` VARCHAR(90) NOT NULL,
 `sha256` CHAR(64) NOT NULL,
 `mimeType` VARCHAR(40) NOT NULL DEFAULT 'image/webp',
 `bytes` INTEGER NOT NULL,
 `width` INTEGER NOT NULL,
 `height` INTEGER NOT NULL,
 `title` VARCHAR(160) NOT NULL,
 `altText` VARCHAR(300) NOT NULL,
 `caption` VARCHAR(500) NULL,
 `rightsConfirmed` BOOLEAN NOT NULL,
 `consentConfirmed` BOOLEAN NOT NULL,
 `status` ENUM('DRAFT','SUBMITTED','APPROVED','REJECTED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
 `uploaderId` CHAR(36) NOT NULL,
 `reviewerId` CHAR(36) NULL,
 `reviewReason` VARCHAR(1000) NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 `reviewedAt` DATETIME(3) NULL,
 UNIQUE INDEX `cms_media_fileKey_key` (`fileKey`),
 INDEX `cms_media_status_createdAt_idx` (`status`,`createdAt`),
 PRIMARY KEY (`id`),
 CONSTRAINT `cms_media_uploaderId_fkey` FOREIGN KEY (`uploaderId`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `cms_media_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
