-- Only newly provisioned temporary Admin credentials must be rotated.
-- Legacy accounts remain valid through the additive FALSE default.
ALTER TABLE `staff_users` ADD COLUMN `mustChangePassword` BOOLEAN NOT NULL DEFAULT FALSE;
