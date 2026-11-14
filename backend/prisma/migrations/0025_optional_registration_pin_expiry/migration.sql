-- An unused registration access PIN may remain valid without an expiration date.
-- Existing PIN expiry values and historical redemption data are preserved.
-- Synthetic UAT credentials retain their separate mandatory expiry contract.
ALTER TABLE `registration_pin_batches` MODIFY COLUMN `expiresAt` DATETIME(3) NULL;
ALTER TABLE `registration_pins` MODIFY COLUMN `expiresAt` DATETIME(3) NULL;
