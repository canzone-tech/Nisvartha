-- Append-only encrypted restoration support for user-requested Admin-only code visibility.
-- Legacy one-way-hash rows remain unrecoverable (NULL sealedCode).
-- PIN_VAULT_KEY stays outside the database and is backed up separately.
ALTER TABLE `uat_signup_pins` ADD COLUMN `sealedCode` VARCHAR(255) NULL;
ALTER TABLE `registration_pins` ADD COLUMN `sealedCode` VARCHAR(255) NULL;
