-- 008: Add the six-digit customer verification code for upgraded databases.
-- Use information_schema so this remains safe to rerun on MySQL and MariaDB.

SET @otp_code_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'customers'
      AND column_name = 'otp_code'
);

SET @add_otp_code_sql := IF(
    @otp_code_exists = 0,
    'ALTER TABLE `customers` ADD COLUMN `otp_code` VARCHAR(6) NULL AFTER `email_verified`',
    'SELECT 1'
);

PREPARE add_otp_code FROM @add_otp_code_sql;
EXECUTE add_otp_code;
DEALLOCATE PREPARE add_otp_code;
