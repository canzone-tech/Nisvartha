-- Append-only financial integrity hardening.
-- Fail closed if historical data already reuses one external settlement reference
-- or violates the approved earning-kind amount/source contract.
ALTER TABLE member_earnings
 ADD UNIQUE KEY member_earnings_settlementReference_key(settlementReference),
 ADD CONSTRAINT member_earnings_kind_amount_level_check CHECK (
  (kind='DIRECT_REFERRAL' AND level IS NULL AND amountPaise=100000 AND sourceMemberId IS NOT NULL AND sourcePositionId IS NULL)
  OR (kind='MATRIX_LEVEL_1' AND level=1 AND amountPaise=250000 AND sourceMemberId IS NULL AND sourcePositionId IS NOT NULL)
  OR (kind='MATRIX_LEVEL_2' AND level=2 AND amountPaise=500000 AND sourceMemberId IS NULL AND sourcePositionId IS NOT NULL)
  OR (kind='MATRIX_LEVEL_3' AND level=3 AND amountPaise=1000000 AND sourceMemberId IS NULL AND sourcePositionId IS NOT NULL)
  OR (kind='MATRIX_LEVEL_4' AND level=4 AND amountPaise=5000000 AND sourceMemberId IS NULL AND sourcePositionId IS NOT NULL)
  OR (kind='MATRIX_LEVEL_5' AND level=5 AND amountPaise=9000000 AND sourceMemberId IS NULL AND sourcePositionId IS NOT NULL)
 );
