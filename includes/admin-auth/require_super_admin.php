<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['admin_id']) || ($_SESSION['admin_role'] ?? '') !== 'Super Admin') {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Super Admin access required']);
    exit;
}
