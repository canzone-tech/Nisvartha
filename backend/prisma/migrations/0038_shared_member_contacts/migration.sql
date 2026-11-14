-- Contacts are non-unique. Existing accounts and referral-code uniqueness remain unchanged.
ALTER TABLE `member_accounts`
 DROP INDEX `member_accounts_email_key`,
 DROP INDEX `member_accounts_mobile_key`,
 ADD INDEX `member_accounts_email_idx`(`email`),
 ADD INDEX `member_accounts_mobile_idx`(`mobile`);
