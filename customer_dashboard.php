<?php
/**
 * Legacy customer dashboard — retired in Phase 4.
 * Replaced by the React dashboard at /dashboard. Old deep links with
 * ?tab=... are mapped to their new routes; customers authenticate through
 * Supabase Auth after the redirect.
 */

$tabRoutes = [
    'overview'     => './dashboard/overview',
    'bookings'     => './dashboard/appointments',
    'notifications' => './dashboard/notifications',
    'reviews'      => './dashboard/reviews',
    'profile'      => './dashboard/profile',
];

$tab = $_GET['tab'] ?? '';

header('Location: ' . ($tabRoutes[$tab] ?? './dashboard'), true, 302);
exit;
