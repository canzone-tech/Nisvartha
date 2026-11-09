-- Append-only financial integrity hardening.
-- Fail closed if historical data already reuses one external settlement reference.
ALTER TABLE member_earnings
 ADD UNIQUE KEY member_earnings_settlementReference_key(settlementReference);
