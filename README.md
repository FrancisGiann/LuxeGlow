# Astrid Nails & Beauty Bar — Project Setup Guide

Welcome to the Astrid Nails & Beauty Bar system (LuxeGlow capstone). The customer-facing
frontend is a **React + Tailwind CSS** single-page app; the PHP backend (booking logic,
conflict detection, notifications, MySQL) is untouched and continues to serve all data.

## Architecture

```
browser ──► React SPA (index.html, /app/*.js)      ← frontend/dist, deployed to project root
              │  fetch() same-origin
              ▼
           PHP API endpoints (/includes/*)          ← unchanged backend
           Admin dashboard (admin_dashboard.php)    ← still classic PHP (staff area)
```

- **Customer site:** `http://localhost/Luxeglow/` — React app (`/dashboard/*` are SPA routes)
- **Staff/Admin area:** `http://localhost/Luxeglow/admin_dashboard.php` — legacy PHP, kept as-is
- Legacy links (`index.php`, `customer_dashboard.php?tab=…`) 302-redirect into the React app

## 1. Install XAMPP
Download from [Apache Friends](https://www.apachefriends.org/index.html). Default settings with Apache + MySQL are fine.

## 2. Copy the Project Files
Paste this project folder into your XAMPP htdocs directory:
`C:\xampp\htdocs\Luxeglow`

> The deployed frontend ships pre-built in this repo (`index.html` + `/app/`). To skip Node entirely, jump to step 3.

## 3. Start Apache and MySQL
Use the XAMPP Control Panel and start both modules.

## 4. Import the Database
1. Open [http://localhost/phpmyadmin/](http://localhost/phpmyadmin/)
2. **Import** tab → choose `database/astrid_nails.sql` → **Go**

## 5. View the Website
Open: **[http://localhost/Luxeglow/](http://localhost/Luxeglow/)**

### Demo Customer Accounts
- `maria.santos@email.com` / `password123`
- `jasmine.reyes@email.com` / `password123`

### Staff Login Credentials
- **Super Admin:** `astrid.admin` / `Ast#2026luxe`
- **Salon Manager:** `rina.mgr` / `Rina#2026`
- **Nail Technician:** `joy.tech` / `Joy#2026`
*(Sign in via "Login → Staff / Admin sign-in" on the React site, or directly at admin_dashboard.php)*

---

## Frontend Development (React)

The React source lives in `frontend/`. Rebuild after making changes:

```bash
cd frontend
npm install
npm run dev        # dev server on http://localhost:5173, proxies /includes + /uploads to XAMPP
npm run build      # production build → dist/
```

Deploy a fresh production build into the project root:

```bash
# from the frontend/ folder
cp -r dist/. ../
```

Configuration lives in env files (see `.env.example`):
- `.env.development` — Vite proxy target (`VITE_PHP_ORIGIN`, `VITE_PHP_SUBDIR`)
- `.env.production` — `VITE_API_BASE=/luxeglow` (sub-path prefix baked into the bundle)

Change it if your htdocs folder name differs.
