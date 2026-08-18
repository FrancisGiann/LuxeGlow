<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// If already logged in as admin, redirect to dashboard
if (isset($_SESSION['admin_id'])) {
    header('Location: admin_dashboard.php?page=home_overview');
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Admin Login — Astrid Nails &amp; Beauty Bar</title>
  <meta name="robots" content="noindex" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="assets/css/admin-page/admin-style.css?v=<?php echo time(); ?>" />
  <style>
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: var(--background, #f9f9fb);
    }
    .admin-login-card {
      width: 100%;
      max-width: 400px;
      padding: 2.5rem;
    }
    .admin-login-header {
      text-align: center;
      margin-bottom: 2rem;
    }
    .admin-login-header h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--foreground, #1a1a1a);
      margin-bottom: 0.5rem;
    }
    .admin-login-header p {
      font-size: 0.875rem;
      color: var(--muted-foreground, #666);
    }
    .alert-error {
      background: #fee2e2;
      border: 1px solid #fca5a5;
      color: #991b1b;
      padding: 0.75rem;
      border-radius: 6px;
      font-size: 0.85rem;
      margin-bottom: 1rem;
      display: none;
    }
  </style>
</head>
<body>
  <div class="card admin-login-card">
    <div class="admin-login-header">
      <h1>Astrid Nails Admin</h1>
      <p>Sign in to access the management portal</p>
    </div>

    <div id="loginError" class="alert-error"></div>

    <form id="adminLoginForm">
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <label class="field">
          <span class="field__label">Username</span>
          <input type="text" id="username" name="username" required autocomplete="username" placeholder="Enter your username" style="padding: 0.6rem 0.75rem; border: 1px solid var(--border, #ccc); border-radius: 6px; font-family: inherit;" />
        </label>

        <label class="field">
          <span class="field__label">Password</span>
          <input type="password" id="password" name="password" required autocomplete="current-password" placeholder="Enter your password" style="padding: 0.6rem 0.75rem; border: 1px solid var(--border, #ccc); border-radius: 6px; font-family: inherit;" />
        </label>

        <button type="submit" class="btn btn--brand" style="margin-top: 0.5rem; padding: 0.75rem; font-size: 0.95rem;">
          Sign In
        </button>
      </div>
    </form>
  </div>

  <script>
    document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('loginError');
      errBox.style.display = 'none';

      const formData = new FormData(e.target);

      try {
        const res = await fetch('includes/admin-auth/login.php', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();

        if (data.success) {
          window.location.href = 'admin_dashboard.php?page=home_overview';
        } else {
          errBox.textContent = data.error || 'Login failed.';
          errBox.style.display = 'block';
        }
      } catch (err) {
        errBox.textContent = 'Connection error. Please try again.';
        errBox.style.display = 'block';
      }
    });
  </script>
</body>
</html>
