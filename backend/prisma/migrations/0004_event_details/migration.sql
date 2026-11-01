-- FR-022: approved event details belong to each CMS revision (not mutable content).
-- Existing approved content and original migrations remain untouched.
ALTER TABLE `cms_revisions`
 ADD COLUMN `eventStartAt` DATETIME(3) NULL,
 ADD COLUMN `eventEndAt` DATETIME(3) NULL,
 ADD COLUMN `eventTimezone` VARCHAR(80) NULL,
 ADD COLUMN `eventVenue` VARCHAR(250) NULL,
 ADD COLUMN `eventOnlineUrl` VARCHAR(2048) NULL,
 ADD COLUMN `eventRegistrationUrl` VARCHAR(2048) NULL,
 ADD COLUMN `eventLifecycle` ENUM('SCHEDULED','POSTPONED','CANCELLED','COMPLETED') NULL;
