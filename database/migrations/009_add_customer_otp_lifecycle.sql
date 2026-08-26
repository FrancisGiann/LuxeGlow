-- 009: Add server-enforced lifecycle timestamps for customer email OTPs.
-- OTP expiry and resend throttling use the database clock in the auth
-- endpoints. Existing rows with no expiry are invalid until a new code is
-- explicitly requested.
-- Use information_schema so this remains safe to rerun on MySQL and MariaDB.

SET @otp_expires_at_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'customers'
      AND column_name = 'otp_expires_at'
);

SET @add_otp_expires_at_sql := IF(
    @otp_expires_at_exists = 0,
    'ALTER TABLE `customers` ADD COLUMN `otp_expires_at` DATETIME NULL AFTER `otp_code`',
    'SELECT 1'
);

PREPARE add_otp_expires_at FROM @add_otp_expires_at_sql;
EXECUTE add_otp_expires_at;
DEALLOCATE PREPARE add_otp_expires_at;

SET @otp_last_sent_at_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'customers'
      AND column_name = 'otp_last_sent_at'
);

SET @add_otp_last_sent_at_sql := IF(
    @otp_last_sent_at_exists = 0,
    'ALTER TABLE `customers` ADD COLUMN `otp_last_sent_at` DATETIME NULL AFTER `otp_expires_at`',
    'SELECT 1'
);

PREPARE add_otp_last_sent_at FROM @add_otp_last_sent_at_sql;
EXECUTE add_otp_last_sent_at;
DEALLOCATE PREPARE add_otp_last_sent_at;

-- Codes from before this migration have no trustworthy issuance time. Clear
-- them so the old plaintext values cannot be mistaken for active codes.
UPDATE `customers`
SET `otp_code` = NULL
WHERE `otp_expires_at` IS NULL;
