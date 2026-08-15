# Astrid Nails & Beauty Bar - Project Setup Guide (Windows)

Welcome to the Astrid Nails & Beauty Bar system. This guide will help you run the project locally on your Windows machine using XAMPP.

## 1. Install XAMPP
If you haven't already, download and install XAMPP for Windows from [Apache Friends](https://www.apachefriends.org/index.html). 
During installation, the default settings are fine (ensure Apache and MySQL are checked).

## 2. Copy the Project Files
1. Copy this entire project folder (`Luxeglow`).
2. Navigate to your XAMPP installation directory (usually `C:\xampp\htdocs\`).
3. Paste the `Luxeglow` folder inside `htdocs`. 
   *(Your path should look like `C:\xampp\htdocs\Luxeglow`)*

## 3. Start Apache and MySQL
1. Open the **XAMPP Control Panel** (you can search for it in the Windows Start menu).
2. Click the **Start** button next to **Apache**.
3. Click the **Start** button next to **MySQL**.
*(Both modules should turn green, indicating they are running.)*

## 4. Import the Database
1. Open your web browser and go to: [http://localhost/phpmyadmin/](http://localhost/phpmyadmin/)
2. In the top menu, click on the **Import** tab.
3. Click the **Choose File** (or Browse) button.
4. Navigate to `C:\xampp\htdocs\Luxeglow\database\` and select the `astrid_nails.sql` file.
5. Scroll to the bottom of the page and click **Import** (or **Go**).
6. You should see a success message saying the import finished.

## 5. View the Website
You are all set! To view and use the system, open your web browser and go to:
**[http://localhost/Luxeglow/](http://localhost/Luxeglow/)**

---

### Staff Login Credentials
To test the admin panel (once backend logic is connected), you can use the following default credentials:
- **Super Admin:** `astrid.admin` / `Ast#2026luxe`
- **Salon Manager:** `rina.mgr` / `Rina#2026`
- **Nail Technician:** `joy.tech` / `Joy#2026`
