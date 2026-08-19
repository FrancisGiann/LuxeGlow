<?php include 'includes/partials/header.php'; ?>

<main>
    <!-- ===== Hero ===== -->
    <section id="home" class="hero">
        <div class="hero__inner">
            <div class="hero__text">
                <span class="hero__badge">✨ LuxeGlow Experience</span>
                <div class="hero__logo">AN</div>
                <h1 class="hero__title">Astrid Nails &amp; Beauty Bar</h1>
                <p class="hero__subtitle">Your Premier Destination for Beauty &amp; Wellness</p>
                <button class="btn btn--brand btn--lg" id="bookHeroBtn">📅 Book Appointment Now</button>
            </div>

            <div class="hero__collage">
                <div class="hero__collage-main">Salon Interior</div>
                <div class="hero__collage-side">Nail Art</div>
                <div class="hero__collage-small">Gel Polish</div>
                <div class="hero__collage-rating">
                    <p class="hero__rating-num">4.9 ★</p>
                    <p class="hero__rating-text">287 reviews from happy clients across Metro Manila</p>
                </div>
            </div>
        </div>
    </section>

    <!-- ===== Services ===== -->
    <section id="services" class="services">
        <div class="section-inner">
            <h2 class="section-title">Our Services</h2>
            <p class="section-subtitle">Premium beauty and wellness treatments for everyone</p>
            <div class="services__grid" id="servicesGrid">
                <!-- injected by script.js -->
            </div>
        </div>
    </section>

    <!-- ===== Reviews ===== -->
    <section id="reviews" class="reviews">
        <div class="section-inner">
            <div class="card card--center reviews__hero">
                <div class="stars" id="heroStars"></div>
                <h2 class="section-title section-title--sm">Astrid Nails &amp; Beauty Bar</h2>
                <p class="section-subtitle">Trusted by hundreds of happy customers</p>
            </div>

            <div class="reviews__stats">
                <div class="card card--center">
                    <p class="stat-num stat-num--pink" id="avgRatingNum">0.0</p>
                    <p class="stat-label">Average rating</p>
                </div>
                <div class="card card--center">
                    <p class="stat-num stat-num--purple" id="totalReviewsNum">0</p>
                    <p class="stat-label">Total reviews</p>
                </div>
            </div>

            <div class="reviews__grid" id="reviewsGrid">
                <!-- injected by script.js -->
            </div>
        </div>
    </section>

    <!-- ===== About ===== -->
    <section id="about" class="about">
        <div class="section-inner">
            <div class="about__header">
                <div class="about__logo">AN</div>
                <h2 class="section-title">About Us</h2>
                <p class="about__lead">
                    Welcome to Astrid Nails &amp; Beauty Bar, your premier destination for luxury nail care and beauty
                    services.
                </p>
            </div>

            <div class="about__grid">
                <article class="card about__card">
                    <h3 class="about__card-title about__card-title--purple">Our Story</h3>
                    <p id="aboutStoryText">
                        At Astrid Nails &amp; Beauty Bar, we are committed to providing exceptional service and creating
                        a
                        relaxing atmosphere where you can unwind and be pampered. Our team of skilled professionals uses
                        only premium products and the latest techniques to ensure you leave feeling beautiful and
                        rejuvenated.
                    </p>
                </article>

                <article class="card about__card">
                    <h3 class="about__card-title about__card-title--pink">Our Mission</h3>
                    <p id="aboutMissionText">
                        To deliver premium beauty and wellness services that enhance our clients' confidence and
                        well-being
                        through expert care, quality products, and personalized attention.
                    </p>
                    <ul class="about__mission-list">
                        <li>✔ Premium quality products and services</li>
                        <li>✔ Experienced and certified professionals</li>
                        <li>✔ Clean, safe and hygienic environment</li>
                        <li>✔ Personalized attention for every client</li>
                    </ul>
                </article>
            </div>
        </div>
    </section>

    <!-- ===== FAQs ===== -->
    <section id="faqs" class="faqs">
        <div class="section-inner section-inner--narrow">
            <div class="card faqs__card">
                <h2 class="section-title">Frequently Asked Questions</h2>
                <div class="faqs__list" id="faqsList">
                    <!-- injected by script.js -->
                </div>
            </div>
        </div>
    </section>
</main>

<?php include 'includes/partials/modals.php'; ?>
<?php include 'includes/partials/footer.php'; ?>