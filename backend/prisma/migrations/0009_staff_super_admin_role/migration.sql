-- Nonfinancial staff RBAC only: expand the existing role enum without rewriting prior migrations.
-- No automatic elevation, default staff records, payments, E-PIN or compensation.
ALTER TABLE `staff_users` MODIFY COLUMN `role`
 ENUM('ADMIN','EDITOR','APPROVER','AUDITOR','SUPER_ADMIN') NOT NULL;
