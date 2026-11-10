-- Immutable versioned non-operational modelling drafts; no financial entitlement or activation path.
CREATE TABLE `sandbox_policy_revisions` (
 `id` INT NOT NULL AUTO_INCREMENT,
 `requestKey` CHAR(36) NOT NULL,
 `entrants` INT NOT NULL,
 `rebirthAtLevel4` INT NOT NULL,
 `rebirthAtLevel5` INT NOT NULL,
 `rebirthLimit` INT NOT NULL,
 `rebirthEnabled` BOOLEAN NOT NULL,
 `status` ENUM('DRAFT','SUBMITTED','REVIEWED','REJECTED') NOT NULL DEFAULT 'DRAFT',
 `authorId` CHAR(36) NOT NULL,
 `reviewerId` CHAR(36) NULL,
 `reason` VARCHAR(300) NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 `submittedAt` DATETIME(3) NULL,
 `reviewedAt` DATETIME(3) NULL,
 UNIQUE INDEX `sandbox_policy_revisions_requestKey_key`(`requestKey`),
 INDEX `sandbox_policy_revisions_status_createdAt_idx`(`status`,`createdAt`),
 PRIMARY KEY (`id`),
 CONSTRAINT `sandbox_policy_revisions_authorId_fkey`
  FOREIGN KEY (`authorId`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `sandbox_policy_revisions_reviewerId_fkey`
  FOREIGN KEY (`reviewerId`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
