<?php
// Legacy PHP compatibility boundary.
//
// The active application uses Supabase PostgREST/RPC and never includes this
// file. Keep a Postgres PDO connection available only for a separately audited
// PHP compatibility port; the old MySQL/MariaDB DSN has deliberately been
// removed so legacy endpoints fail closed instead of dual-writing data.

require_once __DIR__ . '/../vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../');
$dotenv->safeLoad();

$dsn = trim((string)($_ENV['SUPABASE_PDO_DSN'] ?? ''));
$user = (string)($_ENV['SUPABASE_DB_USER'] ?? '');
$password = (string)($_ENV['SUPABASE_DB_PASSWORD'] ?? '');

if ($dsn === '' || $user === '') {
    error_log('Legacy PHP database boundary is disabled; use Supabase client/RPC or configure SUPABASE_PDO_DSN for an audited compatibility port.');
    http_response_code(503);
    if (PHP_SAPI !== 'cli') {
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(['success' => false, 'error' => 'Legacy PHP data boundary is disabled.']);
        exit;
    }
    throw new RuntimeException('Legacy PHP database boundary is disabled.');
}

try {
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    error_log('Supabase Postgres compatibility connection failed: ' . $e->getMessage());
    http_response_code(503);
    if (PHP_SAPI !== 'cli') {
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(['success' => false, 'error' => 'Legacy PHP data boundary unavailable.']);
        exit;
    }
    throw new RuntimeException('Legacy PHP database boundary unavailable.', 0, $e);
}
