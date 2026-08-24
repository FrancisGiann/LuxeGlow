-- 006: Business information for the About page (Objective: essential salon info)
-- Adds admin-editable contact details, business hours and salon policies.

ALTER TABLE `about_content`
    ADD COLUMN `phone` VARCHAR(50) NULL AFTER `mission_statement`,
    ADD COLUMN `email` VARCHAR(120) NULL AFTER `phone`,
    ADD COLUMN `address` VARCHAR(255) NULL AFTER `email`,
    ADD COLUMN `business_hours` TEXT NULL AFTER `address`,
    ADD COLUMN `salon_policies` TEXT NULL AFTER `business_hours`;

-- Seed with values consistent with existing demo data (FAQ hours, staff records).
UPDATE `about_content`
SET `phone`          = '0917 000 1122',
    `email`          = 'hello@astridnails.ph',
    `address`        = '12 Mabini St, Quezon City, Metro Manila',
    `business_hours` = 'Monday – Saturday: 10:00 AM – 8:00 PM\nSunday: 11:00 AM – 6:00 PM',
    `salon_policies` = 'Online bookings are held for 15 minutes past the scheduled time — late arrivals may be automatically cancelled.\nKindly cancel or reschedule at least 24 hours in advance by contacting us.\nWalk-ins are welcome subject to availability; online bookings receive priority scheduling.\nAll tools are sterilized after every client, and only certified, cruelty-free products are used.\nPayment is settled in-store after your service — we currently do not accept online payments.'
WHERE `id` = (SELECT `id` FROM (SELECT `id` FROM `about_content` ORDER BY `id` ASC LIMIT 1) AS t);
