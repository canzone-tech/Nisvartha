-- Local-UAT-only illustrative joining and referral reference events.
-- No settlement, money movement, payable reward, wallet or financial entitlement.
CREATE TABLE `uat_scenario_entries` (
 `id` CHAR(36) NOT NULL,
 `kind` ENUM('JOINING_REFERENCE','DIRECT_REFERRAL_REFERENCE') NOT NULL,
 `sourceMemberId` CHAR(36) NOT NULL,
 `beneficiaryMemberId` CHAR(36) NOT NULL,
 `recordedByStaffId` CHAR(36) NOT NULL,
 `requestKey` CHAR(36) NULL,
 `amountPaise` INT NOT NULL,
 `source` VARCHAR(32) NOT NULL DEFAULT 'UNVERIFIED_FLYER',
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (`id`),
 UNIQUE KEY `uat_scenario_entries_requestKey_key` (`requestKey`),
 UNIQUE KEY `uat_scenario_entries_kind_sourceMemberId_key` (`kind`,`sourceMemberId`),
 KEY `uat_scenario_entries_beneficiaryMemberId_createdAt_idx` (`beneficiaryMemberId`,`createdAt`),
 KEY `uat_scenario_entries_recordedByStaffId_fkey` (`recordedByStaffId`),
 CONSTRAINT `uat_scenario_entries_sourceMemberId_fkey` FOREIGN KEY (`sourceMemberId`) REFERENCES `member_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `uat_scenario_entries_beneficiaryMemberId_fkey` FOREIGN KEY (`beneficiaryMemberId`) REFERENCES `member_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `uat_scenario_entries_recordedByStaffId_fkey` FOREIGN KEY (`recordedByStaffId`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
