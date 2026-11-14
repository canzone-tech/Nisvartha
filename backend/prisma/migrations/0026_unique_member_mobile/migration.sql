-- Preserve existing members: historic rows initially have NULL mobile.
-- Every new immediate-activation signup must supply a canonical E.164 mobile.
-- MySQL's unique index rejects duplicate non-NULL mobile identities under concurrency.
ALTER TABLE `member_accounts` ADD COLUMN `mobile` VARCHAR(16) NULL;
CREATE UNIQUE INDEX `member_accounts_mobile_key` ON `member_accounts`(`mobile`);
