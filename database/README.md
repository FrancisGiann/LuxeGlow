# Astrid Nails & Beauty Bar Database

This directory contains the MySQL database schema and seed data for the capstone project.

## Files
- `astrid_nails.sql`: The main SQL script to create the database, tables, and insert sample data (mirrors the frontend mock arrays).

## Table Structure Breakdown
1. **`customers`**: Stores unique client details (name, email, phone). The frontend mock data fields like `visits` and `spent` can be dynamically queried by joining this with `appointments`.
2. **`services`**: Contains the catalog of services, including pricing and a newly added `duration_minutes` (integer) for easy total-duration calculations.
3. **`appointments`**: Stores booking records. It acts as the central hub, linking a customer to a time slot and tracking the total price and status (`Pending`, `Confirmed`, `Completed`, `Cancelled`).
4. **`appointment_services`**: A junction table that allows **multiple services** per single appointment, supporting the frontend booking wizard's ability to select several items at once.
5. **`staff_accounts`**: Stores admin and employee details. Passwords here have been hashed using PHP's `password_hash()` (bcrypt) for immediate compatibility with your backend login logic.
6. **`faqs`**: Simple table to store the dynamic Frequently Asked Questions.
7. **`about_content`**: A single-row configuration table to store the salon's name, description, and mission.

## How to Import into XAMPP / phpMyAdmin

1. Ensure **XAMPP** is running and both **Apache** and **MySQL** are started.
2. Open your browser and navigate to [http://localhost/phpmyadmin/](http://localhost/phpmyadmin/).
3. In the top menu, click on the **Import** tab.
4. Under the *File to import* section, click **Choose File** and select `astrid_nails.sql` from this directory.
5. Scroll to the bottom and click **Import** (or **Go** depending on your phpMyAdmin version).
6. Once successful, you will see a new database named `astrid_nails` on the left sidebar containing all the tables populated with the mock data.

## PHP Password Hashing Note
The staff passwords in the SQL file are pre-hashed. To verify them in your PHP login script later, use:
```php
if (password_verify($input_password, $hashed_password_from_db)) {
    // Login success
}
```
* **astrid.admin**: `Ast#2026luxe`
* **rina.mgr**: `Rina#2026`
* **joy.tech**: `Joy#2026`
* **leah.desk**: `Leah#2026`
