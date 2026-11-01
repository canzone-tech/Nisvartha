-- Append-only P1 enquiry case-management migration. Existing P0 records preserved.
ALTER TABLE `enquiries`
 MODIFY COLUMN `status` ENUM('NEW','IN_REVIEW','CONTACTED','ACCEPTED','DECLINED','WITHDRAWN','CLOSED') NOT NULL DEFAULT 'NEW',
 ADD COLUMN `assignedToId` CHAR(36) NULL,
 ADD COLUMN `caseRevision` INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN `archivedAt` DATETIME(3) NULL,
 ADD COLUMN `legalHoldAt` DATETIME(3) NULL,
 ADD COLUMN `anonymizedAt` DATETIME(3) NULL,
 ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 ADD INDEX `enquiries_assignedToId_status_idx` (`assignedToId`,`status`),
 ADD CONSTRAINT `enquiries_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `enquiry_notes` (
 `id` CHAR(36) NOT NULL,
 `enquiryId` CHAR(36) NOT NULL,
 `authorId` CHAR(36) NOT NULL,
 `body` TEXT NOT NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX `enquiry_notes_enquiryId_createdAt_idx` (`enquiryId`,`createdAt`),
 PRIMARY KEY (`id`),
 CONSTRAINT `enquiry_notes_enquiryId_fkey` FOREIGN KEY (`enquiryId`) REFERENCES `enquiries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `enquiry_notes_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
