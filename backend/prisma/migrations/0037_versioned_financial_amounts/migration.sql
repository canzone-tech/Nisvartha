-- Append-only 0037: bound future-effective offline prices and earning amounts.
-- Preserve legacy row values, existing earning keys and paid settlements.
-- Keep structural kind/level safety at DB boundary; service validates
-- immutable plan-specific amounts and receipt-funded ledger creation.
ALTER TABLE member_offline_sales
 DROP CHECK member_offline_sales_amount,
 ADD CONSTRAINT member_offline_sales_amount_range
  CHECK (amountPaise BETWEEN 10000 AND 40000000);

ALTER TABLE member_earnings
 DROP CHECK member_earnings_kind_amount_level_check,
 ADD CONSTRAINT member_earnings_kind_level_check CHECK (
  (kind='DIRECT_REFERRAL' AND level IS NULL)
  OR (kind='MATRIX_LEVEL_1' AND level=1)
  OR (kind='MATRIX_LEVEL_2' AND level=2)
  OR (kind='MATRIX_LEVEL_3' AND level=3)
  OR (kind='MATRIX_LEVEL_4' AND level=4)
  OR (kind='MATRIX_LEVEL_5' AND level=5)
 );
