-- 0036: immutable, forward-effective financial plan versions.
-- Never recalculate historical member, earning, payout or receipt amounts.
CREATE TABLE `financial_plan_versions` (
 `id` INT NOT NULL AUTO_INCREMENT,
 `requestKey` CHAR(36) NOT NULL,
 `reason` VARCHAR(500) NOT NULL,
 `joiningAmountPaise` INT NOT NULL,
 `directReferralPaise` INT NOT NULL,
 `level1Paise` INT NOT NULL,
 `level2Paise` INT NOT NULL,
 `level3Paise` INT NOT NULL,
 `level4Paise` INT NOT NULL,
 `level5Paise` INT NOT NULL,
 `rebirthAtLevel4` TINYINT NOT NULL,
 `rebirthAtLevel5` TINYINT NOT NULL,
 `publishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 `createdById` CHAR(36) NULL,
 PRIMARY KEY (`id`),
 UNIQUE KEY `financial_plan_versions_requestKey_key` (`requestKey`),
 CONSTRAINT `financial_plan_versions_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `financial_plan_versions_valid_amounts` CHECK (
  `joiningAmountPaise` BETWEEN 10000 AND 200000000 AND
  `directReferralPaise` BETWEEN 0 AND 200000000 AND
  `level1Paise` BETWEEN 0 AND 200000000 AND
  `level2Paise` BETWEEN 0 AND 200000000 AND
  `level3Paise` BETWEEN 0 AND 200000000 AND
  `level4Paise` BETWEEN 0 AND 200000000 AND
  `level5Paise` BETWEEN 0 AND 200000000 AND
  `rebirthAtLevel4` BETWEEN 0 AND 8 AND
  `rebirthAtLevel5` BETWEEN 0 AND 8
 )
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `financial_plan_versions` (
 `id`, `requestKey`, `reason`, `joiningAmountPaise`, `directReferralPaise`,
 `level1Paise`, `level2Paise`, `level3Paise`, `level4Paise`, `level5Paise`,
 `rebirthAtLevel4`, `rebirthAtLevel5`, `createdById`
) VALUES (1, '00000000-0000-4000-8000-000000000001',
 'Initial owner-confirmed versioned baseline', 1500000, 100000,
 250000, 500000, 1000000, 5000000, 9000000, 1, 3, NULL);

CREATE TABLE `financial_plan_state` (
 `id` TINYINT NOT NULL,
 `currentVersionId` INT NOT NULL,
 `revision` INT NOT NULL DEFAULT 1,
 `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (`id`),
 UNIQUE KEY `financial_plan_state_currentVersionId_key` (`currentVersionId`),
 CONSTRAINT `financial_plan_state_currentVersionId_fkey`
  FOREIGN KEY (`currentVersionId`) REFERENCES `financial_plan_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `financial_plan_state_singleton` CHECK (`id` = 1)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
INSERT INTO `financial_plan_state` (`id`,`currentVersionId`,`revision`) VALUES (1,1,1);

-- Nullable grandfathering for previous memberships, verified PIN receipts,
-- and already-earned immutable money. Never backfill speculative plan rights.
ALTER TABLE `member_accounts`
 ADD COLUMN `financialPlanVersionId` INT NULL,
 ADD CONSTRAINT `member_accounts_financialPlanVersionId_fkey`
  FOREIGN KEY (`financialPlanVersionId`) REFERENCES `financial_plan_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `registration_pin_paid_batches`
 ADD COLUMN `financialPlanVersionId` INT NULL,
 ADD CONSTRAINT `registration_pin_paid_batches_financialPlanVersionId_fkey`
  FOREIGN KEY (`financialPlanVersionId`) REFERENCES `financial_plan_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `member_earnings`
 ADD COLUMN `financialPlanVersionId` INT NULL,
 ADD CONSTRAINT `member_earnings_financialPlanVersionId_fkey`
  FOREIGN KEY (`financialPlanVersionId`) REFERENCES `financial_plan_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Replace the old fixed ₹15,000 constraints only after adding immutable
-- per-batch plan references; every paid receipt still carries its exact unit.
ALTER TABLE `registration_pin_paid_batches`
 DROP CHECK `registration_pin_paid_batches_unit_check`,
 DROP CHECK `registration_pin_paid_batches_total_check`,
 ADD CONSTRAINT `registration_pin_paid_batches_unit_range`
  CHECK (`unitAmountPaise` BETWEEN 10000 AND 200000000),
 ADD CONSTRAINT `registration_pin_paid_batches_total_range`
  CHECK (`verifiedAmountPaise` BETWEEN 10000 AND 2000000000);
ALTER TABLE `registration_pin_paid_redemptions`
 DROP CHECK `registration_pin_paid_redemptions_amount_check`,
 ADD CONSTRAINT `registration_pin_paid_redemptions_amount_range`
  CHECK (`amountPaise` BETWEEN 10000 AND 200000000);
