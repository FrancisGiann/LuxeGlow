<?php
// includes/cron/run_notifier.php
// Production HTTP wrapper endpoint for cron-job.org execution

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/appointment_notifier.php';

header('Content-Type: application/json');

// Secret token check (Define secret token in environment or fallback constant)
$expectedToken = $_ENV['CRON_SECRET_TOKEN'] ?? 'astrid_cron_secret_key_2026';
$providedToken = $_GET['token'] ?? ($_SERVER['HTTP_X_CRON_TOKEN'] ?? '');

if (!$providedToken || !hash_equals($expectedToken, $providedToken)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized cron invocation']);
    exit;
}

$summary = runAppointmentNotifier($pdo, false);

echo json_encode([
    'success' => true,
    'summary' => $summary
]);
