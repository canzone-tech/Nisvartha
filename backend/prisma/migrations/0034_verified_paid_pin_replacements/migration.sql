-- Q8-A: a successor PIN reuses the already verified payment batch.
-- Do not create another bank receipt or change historical migrations.
CREATE TABLE `registration_pin_replacements` (
 `oldPinId` CHAR(36) NOT NULL,
 `newPinId` CHAR(36) NOT NULL,
 `requestKey` CHAR(36) NOT NULL,
 `issuedById` CHAR(36) NOT NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (`oldPinId`),
 UNIQUE KEY `registration_pin_replacements_newPinId_key` (`newPinId`),
 UNIQUE KEY `registration_pin_replacements_requestKey_key` (`requestKey`),
 KEY `registration_pin_replacements_issuedById_createdAt_idx` (`issuedById`,`createdAt`),
 CONSTRAINT `registration_pin_replacements_oldPinId_fkey` FOREIGN KEY (`oldPinId`) REFERENCES `registration_pins`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `registration_pin_replacements_newPinId_fkey` FOREIGN KEY (`newPinId`) REFERENCES `registration_pins`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `registration_pin_replacements_issuedById_fkey` FOREIGN KEY (`issuedById`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
