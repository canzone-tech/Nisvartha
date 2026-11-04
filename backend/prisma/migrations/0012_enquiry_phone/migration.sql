-- Append-only telephone field matching approved client forms.
ALTER TABLE `enquiries` ADD COLUMN `phone` VARCHAR(20) NULL;
