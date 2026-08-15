-- Migration 002: Add customer authentication fields and split name

-- 1. Add first_name and last_name, and rename is_verified
ALTER TABLE customers 
ADD COLUMN first_name VARCHAR(100) AFTER customer_id,
ADD COLUMN last_name VARCHAR(100) AFTER first_name,
CHANGE is_verified email_verified TINYINT(1) NOT NULL DEFAULT 0;

-- 2. Split existing mock names
UPDATE customers 
SET first_name = SUBSTRING_INDEX(name, ' ', 1),
    last_name = SUBSTRING(name, LENGTH(SUBSTRING_INDEX(name, ' ', 1)) + 2);

-- 3. Drop the old unified name column
ALTER TABLE customers DROP COLUMN name;
