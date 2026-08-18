<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Astrid Nails &amp; Beauty Bar — Book Nails, Lashes &amp; Spa</title>
  <meta name="description" content="Astrid Nails & Beauty Bar: premium nail care, gel polish, extensions, lashes and spa treatments. Book your appointment online in three steps." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css" />
  <script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
  <link rel="stylesheet" href="assets/css/style.css?v=<?php echo time(); ?>" />
</head>
<body>

  <!-- ===== Navbar ===== -->
  <header class="navbar" id="navbar">
    <nav class="navbar__inner">
      <a href="index.php#home" class="navbar__brand">
        <span class="navbar__logo">AN</span>
        <span class="navbar__brand-text">
          <span class="navbar__brand-title">Astrid Nails</span>
          <span class="navbar__brand-sub">&amp; Beauty Bar</span>
        </span>
      </a>

      <div class="navbar__links" id="navLinks">
        <a href="index.php#home" class="navbar__link">Home</a>
        <a href="index.php#services" class="navbar__link">Services</a>
        <a href="index.php#reviews" class="navbar__link">Reviews</a>
        <a href="index.php#about" class="navbar__link">About</a>
        <a href="index.php#faqs" class="navbar__link">FAQs</a>
      </div>

      <div class="navbar__actions">
        <button class="btn btn--soft" id="loginBtn">Login / Register</button>
        <button class="btn btn--brand" id="bookNavBtn">Book Now</button>
      </div>

      <button class="navbar__toggle" id="navToggle" aria-label="Toggle menu">
        <span></span><span></span><span></span>
      </button>
    </nav>

    <div class="navbar__mobile" id="navMobile">
      <a href="index.php#home" class="navbar__link">Home</a>
      <a href="index.php#services" class="navbar__link">Services</a>
      <a href="index.php#reviews" class="navbar__link">Reviews</a>
      <a href="index.php#about" class="navbar__link">About</a>
      <a href="index.php#faqs" class="navbar__link">FAQs</a>
      <button class="btn btn--soft" id="loginBtnMobile">Login / Register</button>
      <button class="btn btn--brand" id="bookNavBtnMobile">Book Now</button>
    </div>
  </header>