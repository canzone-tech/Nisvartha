CREATE TABLE `enquiries` (
  `id` CHAR(36) NOT NULL,
  `reference` VARCHAR(40) NOT NULL,
  `category` ENUM('CONTACT','VOLUNTEER') NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(254) NOT NULL,
  `subject` VARCHAR(160) NOT NULL,
  `message` TEXT NOT NULL,
  `interests` VARCHAR(300) NULL,
  `availability` VARCHAR(300) NULL,
  `consentAt` DATETIME(3) NOT NULL,
  `status` ENUM('NEW','IN_REVIEW','CLOSED') NOT NULL DEFAULT 'NEW',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `enquiries_reference_key` (`reference`),
  INDEX `enquiries_category_createdAt_idx` (`category`,`createdAt`),
  INDEX `enquiries_status_createdAt_idx` (`status`,`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
