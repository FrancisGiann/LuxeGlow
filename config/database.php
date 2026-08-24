<?php
// config/database.php

require_once __DIR__ . '/../vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../');
$dotenv->safeLoad();

define('DB_HOST', $_ENV['DB_HOST'] ?? '127.0.0.1');
define('DB_NAME', $_ENV['DB_NAME'] ?? 'astrid_nails');
define('DB_USER', $_ENV['DB_USER'] ?? 'root');
define('DB_PASS', $_ENV['DB_PASS'] ?? '');

try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]
    );
} catch (PDOException $e) {
    // Endpoint scripts live under includes/, while page scripts may include this
    // file to render HTML. Use the actual caller path instead of request headers
    // or URL text, which can be absent or spoofed.
    $caller = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 2)[0]['file'] ?? '';
    $caller = $caller !== '' ? realpath($caller) : false;
    $endpointDirectory = realpath(__DIR__ . '/../includes');
    $isEndpoint = $caller !== false
        && $endpointDirectory !== false
        && strncmp($caller, $endpointDirectory . DIRECTORY_SEPARATOR, strlen($endpointDirectory . DIRECTORY_SEPARATOR)) === 0;

    // Keep connection details out of responses; retain the diagnostic in the
    // server log for operators.
    error_log('Database connection failed: ' . $e->getMessage());

    if ($isEndpoint) {
        http_response_code(500);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(['success' => false, 'error' => 'Database connection unavailable.']);
        exit;
    }

    // Direct page includes retain a plain failure response without leaking
    // connection details.
    http_response_code(500);
    die('Database connection unavailable.');
}
