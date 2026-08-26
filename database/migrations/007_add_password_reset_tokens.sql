-- 007: Dedicated, short-lived customer password reset tokens.
-- Only a password hash is stored; the emailed six-digit code is never persisted.

CREATE TABLE `password_reset_tokens` (
    `reset_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `customer_id` INT NOT NULL,
    `token_hash` VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `expires_at` DATETIME NOT NULL,
    `attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `used_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`reset_id`),
    UNIQUE KEY `uq_password_reset_customer` (`customer_id`),
    UNIQUE KEY `uq_password_reset_token_hash` (`token_hash`),
    KEY `idx_password_reset_expires_at` (`expires_at`),
    CONSTRAINT `fk_password_reset_customer`
        FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
