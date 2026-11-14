-- Owner-confirmed rule: no arbitrary payout minimum.
-- Replace the old >=100 paise CHECK atomically with strictly positive paise.
-- Existing rows already satisfy the stronger historical threshold and remain untouched.
ALTER TABLE `member_payout_requests`
 DROP CHECK `member_payout_requests_positive`,
 ADD CONSTRAINT `member_payout_requests_positive_paise`
 CHECK (`amountPaise` BETWEEN 1 AND 2000000000);
