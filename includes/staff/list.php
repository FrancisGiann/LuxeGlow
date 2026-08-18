<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../admin-auth/require_super_admin.php';
header('Content-Type: application/json');

try {
    $stmt = $pdo->query("
        SELECT account_id, name, position, contact_number, email, address, username, status, role, created_at
        FROM staff_accounts
        ORDER BY account_id ASC
    ");
    $accounts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($accounts);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error loading staff accounts']);
}
