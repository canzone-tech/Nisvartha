-- Append-only financial integrity hardening.
-- Fail closed if historical data already reuses one external settlement reference
-- or violates the approved earning-kind amount/level contract.
ALTER TABLE member_earnings
 ADD UNIQUE KEY member_earnings_settlementReference_key(settlementReference),
 ADD CONSTRAINT member_earnings_kind_amount_level_check CHECK (
  (kind='DIRECT_REFERRAL' AND level IS NULL AND amountPaise=100000)
  OR (kind='MATRIX_LEVEL_1' AND level=1 AND amountPaise=250000)
  OR (kind='MATRIX_LEVEL_2' AND level=2 AND amountPaise=500000)
  OR (kind='MATRIX_LEVEL_3' AND level=3 AND amountPaise=1000000)
  OR (kind='MATRIX_LEVEL_4' AND level=4 AND amountPaise=5000000)
  OR (kind='MATRIX_LEVEL_5' AND level=5 AND amountPaise=9000000)
 );
