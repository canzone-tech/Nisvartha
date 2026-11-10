-- Save member payout destinations encrypted, independently of earnings/payments.
-- Existing member accounts and historic payout requests remain unchanged.
-- New payout requests preserve an immutable encrypted destination snapshot.
CREATE TABLE member_payout_profiles (
 memberId CHAR(36) NOT NULL,
 bankCiphertext VARCHAR(1024) NULL,
 upiCiphertext VARCHAR(1024) NULL,
 bankMask VARCHAR(50) NULL,
 upiMask VARCHAR(50) NULL,
 defaultMethod ENUM('BANK','UPI') NULL,
 updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(memberId),
 CONSTRAINT member_payout_profiles_memberId_fkey FOREIGN KEY(memberId)
  REFERENCES member_accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT member_payout_profiles_bank_pair CHECK (
  (bankCiphertext IS NULL AND bankMask IS NULL) OR
  (bankCiphertext IS NOT NULL AND bankMask IS NOT NULL)),
 CONSTRAINT member_payout_profiles_upi_pair CHECK (
  (upiCiphertext IS NULL AND upiMask IS NULL) OR
  (upiCiphertext IS NOT NULL AND upiMask IS NOT NULL)),
 CONSTRAINT member_payout_profiles_default_present CHECK (
  defaultMethod IS NULL OR
  (defaultMethod='BANK' AND bankCiphertext IS NOT NULL) OR
  (defaultMethod='UPI' AND upiCiphertext IS NOT NULL))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE member_payout_requests
 ADD COLUMN payoutMethod ENUM('BANK','UPI') NULL,
 ADD COLUMN destinationCiphertext VARCHAR(1024) NULL,
 ADD COLUMN destinationMask VARCHAR(50) NULL,
 ADD CONSTRAINT member_payout_requests_destination_pair CHECK (
  (payoutMethod IS NULL AND destinationCiphertext IS NULL AND destinationMask IS NULL)
  OR
  (payoutMethod IS NOT NULL AND destinationCiphertext IS NOT NULL AND destinationMask IS NOT NULL)
 );
