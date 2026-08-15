-- ==========================================================
-- Astrid Nails & Beauty Bar
-- Database Schema & Sample Data Seed
-- ==========================================================

CREATE DATABASE IF NOT EXISTS astrid_nails;
USE astrid_nails;

-- --------------------------------------------------------
-- 1. Customers Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- 2. Services Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS services (
    service_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    duration_minutes INT NOT NULL,
    rating DECIMAL(2, 1) DEFAULT 0.0
);

-- --------------------------------------------------------
-- 3. Appointments Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments (
    appointment_id VARCHAR(50) PRIMARY KEY,
    customer_id INT NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    status ENUM('Pending', 'Confirmed', 'Completed', 'Cancelled') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    INDEX idx_appointment_datetime (appointment_date, appointment_time)
);

-- --------------------------------------------------------
-- 4. Appointment Services (Many-to-Many)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointment_services (
    appointment_id VARCHAR(50) NOT NULL,
    service_id VARCHAR(50) NOT NULL,
    PRIMARY KEY (appointment_id, service_id),
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE CASCADE
);

-- --------------------------------------------------------
-- 5. Staff Accounts Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_accounts (
    account_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    position VARCHAR(100) NOT NULL,
    contact_number VARCHAR(50),
    email VARCHAR(255) UNIQUE NOT NULL,
    address TEXT,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status ENUM('Active', 'Inactive') DEFAULT 'Active',
    role ENUM('Super Admin', 'Staff') DEFAULT 'Staff',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- 6. FAQs Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS faqs (
    faq_id INT AUTO_INCREMENT PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    display_order INT DEFAULT 0
);

-- --------------------------------------------------------
-- 7. About Content Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS about_content (
    id INT AUTO_INCREMENT PRIMARY KEY,
    salon_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    mission_statement TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


-- ==========================================================
-- Sample Data Seeding
-- ==========================================================

-- Seed Customers
INSERT INTO customers (name, email, phone) VALUES
('Maria Santos', 'maria.santos@email.com', '0917 221 4488'),
('Jasmine Reyes', 'jasmine.reyes@email.com', '0918 553 1102'),
('Andrea Lim', 'andrea.lim@email.com', '0921 447 9080'),
('Paolo Cruz', 'paolo.cruz@email.com', '0906 118 2277'),
('Kim Dela Cruz', 'kim.dc@email.com', '0995 330 7712')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Seed Services
INSERT INTO services (service_id, name, category, description, price, duration_minutes, rating) VALUES
('nail-care', 'Nail Care', 'Nails', 'Basic nail care and grooming', 1500.00, 45, 4.5),
('gel-polish', 'Gel Polish', 'Nails', 'Long lasting gel polish application', 1500.00, 60, 4.5),
('nail-extension', 'Nail Extensions', 'Nails', 'Beautiful acrylic or gel extensions', 1500.00, 90, 4.0),
('lash-extension', 'Lash Extension', 'Lashes', 'Volume lashes applied by certified artists', 1800.00, 60, 5.0),
('wax-hair-removal', 'Wax Hair Removal', 'Waxing', 'Gentle waxing with premium soft wax', 900.00, 30, 4.5),
('spa-treatment', 'Spa Treatment', 'Spa', 'Relaxing foot and hand spa ritual', 1200.00, 60, 5.0),
('kiddie-package', 'Kiddie Package', 'Packages', 'Fun and safe pampering for kids', 700.00, 30, 4.5),
('gentleman-package', 'Gentleman Package', 'Packages', 'Grooming essentials for gentlemen', 1400.00, 60, 4.5),
('massage', 'Massage', 'Spa', 'Relaxing therapeutic massage', 350.00, 30, 4.5)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Seed Appointments (Linking directly to customer_id assuming auto-increment starts at 1)
-- Customer 1: Maria Santos
-- Customer 2: Jasmine Reyes
-- Customer 3: Andrea Lim
-- Customer 4: Paolo Cruz
-- Customer 5: Kim Dela Cruz
INSERT IGNORE INTO appointments (appointment_id, customer_id, appointment_date, appointment_time, total_price, status) VALUES
('BK-1041', 1, '2026-08-15', '14:00:00', 1500.00, 'Confirmed'),
('BK-1040', 2, '2026-08-15', '11:30:00', 1800.00, 'Completed'),
('BK-1039', 3, '2026-08-16', '10:00:00', 1200.00, 'Pending'),
('BK-1038', 4, '2026-08-16', '16:30:00', 1400.00, 'Confirmed'),
('BK-1037', 5, '2026-06-18', '13:00:00', 1500.00, 'Pending');

-- Seed Appointment Services
INSERT IGNORE INTO appointment_services (appointment_id, service_id) VALUES
('BK-1041', 'gel-polish'),
('BK-1040', 'lash-extension'),
('BK-1039', 'spa-treatment'),
('BK-1038', 'gentleman-package'),
('BK-1037', 'nail-extension');

-- Seed Staff Accounts (with PHP password_hash() results)
-- Note: Raw passwords are in comments for reference during development
INSERT INTO staff_accounts (name, position, contact_number, email, address, username, password_hash, status, role) VALUES
('Astrid Villanueva', 'Super Admin', '0917 000 1122', 'astrid@astridnails.com', '12 Mabini St, Quezon City', 'astrid.admin', '$2y$12$7d9P5NP4fu64rXMJnFifzO2oCqgqXnJaT4A8YYfZugBe8bwmqeTVe', 'Active', 'Super Admin'), -- Ast#2026luxe
('Rina Bautista', 'Salon Manager', '0918 224 5566', 'rina@astridnails.com', '8 Katipunan Ave, Quezon City', 'rina.mgr', '$2y$12$OitKjoYseS0q5gHkEznTuuyfC6WiNQNlnLBqGdvcG/cts2oF9UuWG', 'Active', 'Staff'), -- Rina#2026
('Joy Mercado', 'Nail Technician', '0927 883 4410', 'joy@astridnails.com', '45 Aurora Blvd, Manila', 'joy.tech', '$2y$12$2fzEmtu3J3Bq4N7JLLLof.TAPGdnSAjwn.FmWCwWyliue8J.7gSN.', 'Active', 'Staff'), -- Joy#2026
('Leah Ramos', 'Front Desk', '0933 771 9021', 'leah@astridnails.com', '3 Rizal St, Pasig', 'leah.desk', '$2y$12$6hTXUBF0uKUxwWvxMqFJRO6iazRZGgT..3JMgGsBNILyuZrQP.0s6', 'Inactive', 'Staff') -- Leah#2026
ON DUPLICATE KEY UPDATE username=VALUES(username);

-- Seed FAQs
INSERT INTO faqs (question, answer, display_order) VALUES
('What are your operating hours?', 'We are open Monday to Saturday from 10:00 AM to 8:00 PM, and Sundays from 11:00 AM to 6:00 PM.', 1),
('What services do you offer?', 'Nail care, gel polish, nail extensions, lash extensions, waxing, spa treatments, massages, and curated kiddie and gentleman packages.', 2),
('Are your products safe and hygienic?', 'Yes. All tools are sterilized after every client, single-use items are never reused, and we only use certified, cruelty-free products.', 3),
('Do I need to book an appointment?', 'Walk-ins are welcome when slots allow, but booking online guarantees your preferred stylist and time slot.', 4);

-- Seed About Content
INSERT INTO about_content (salon_name, description, mission_statement) VALUES
(
    'Astrid Nails & Beauty Bar', 
    'A premium sanctuary dedicated to providing top-notch nail, lash, and spa services in a relaxing, hygienic environment.', 
    'Our mission is to elevate beauty and self-care by offering personalized, high-quality services that make every client feel refreshed, confident, and pampered.'
);
