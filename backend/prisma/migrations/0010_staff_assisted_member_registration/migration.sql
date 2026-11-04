-- Nonfinancial consent-evidenced staff-assisted application intake.
-- Append-only: earlier deployed migrations must remain immutable.
-- No issued PIN, payment, commission, member placement or wallet.
ALTER TABLE `membership_applications`
 ADD COLUMN `registrationSource` ENUM('PUBLIC','STAFF_ASSISTED') NOT NULL DEFAULT 'PUBLIC',
 ADD COLUMN `registeredByStaffId` CHAR(36) NULL,
 ADD COLUMN `consentEvidenceRef` VARCHAR(120) NULL;

CREATE INDEX `membership_applications_registeredByStaffId_createdAt_idx`
 ON `membership_applications`(`registeredByStaffId`,`createdAt`);

ALTER TABLE `membership_applications`
 ADD CONSTRAINT `membership_applications_registeredByStaffId_fkey`
 FOREIGN KEY (`registeredByStaffId`) REFERENCES `staff_users`(`id`)
 ON DELETE RESTRICT ON UPDATE CASCADE;
