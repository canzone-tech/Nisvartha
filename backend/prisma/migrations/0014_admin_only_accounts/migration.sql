-- Consolidate staff account types without granting admin access to former scoped staff.
-- Earlier migrations are immutable. This migration must be applied with a reviewed backup and staging rehearsal.
-- Retain a record of previous roles before changing the enum.
INSERT INTO `cms_audit` (`id`,`actorId`,`action`,`objectType`,`objectId`,`summary`,`createdAt`)
SELECT UUID(), `id`, 'ROLE_CONSOLIDATION', 'STAFF', `id`,
 CONCAT('Previous role ', `role`, '; legacy limited-access accounts disabled pending explicit admin reauthorization'), CURRENT_TIMESTAMP(3)
FROM `staff_users` WHERE `role` <> 'ADMIN';

UPDATE `staff_sessions` AS s
INNER JOIN `staff_users` AS u ON u.`id` = s.`staffId`
SET s.`revokedAt`=CURRENT_TIMESTAMP(3)
WHERE u.`role` <> 'ADMIN' AND s.`revokedAt` IS NULL;

UPDATE `staff_users` SET `status`='DISABLED'
WHERE `role` IN ('EDITOR','APPROVER','AUDITOR');
-- SUPER_ADMIN possessed at least ADMIN authority and becomes an ordinary ADMIN.
UPDATE `staff_users` SET `role`='ADMIN' WHERE `role` <> 'ADMIN';
ALTER TABLE `staff_users` MODIFY COLUMN `role` ENUM('ADMIN') NOT NULL;
