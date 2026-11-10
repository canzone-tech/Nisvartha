-- Shared external transfer reference uniqueness extends to PIN refunds.
-- Append-only enum extension preserves EARNING and PAYOUT records.
ALTER TABLE `financial_settlement_references`
 MODIFY COLUMN `sourceKind` ENUM('EARNING','PAYOUT','PIN_REFUND') NOT NULL;
