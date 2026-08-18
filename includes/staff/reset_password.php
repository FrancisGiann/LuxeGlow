<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../admin-auth/require_super_admin.php';
header('Content-Type: application/json');

$accountId = (int)($_POST['account_id'] ?? 0);
$newPassword = $_POST['new_password'] ?? '';

if ($accountId <= 0 || !$newPassword) {
    echo json_encode(['success' => false, 'error' => 'Account ID and new password are required.']);
    exit;
}

if (strlen($newPassword) < 8) {
    echo json_encode(['success' => false, 'error' => 'New password must be at least 8 characters long.']);
    exit;
}

try {
    $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);

    $stmt = $pdo->prepare("UPDATE staff_accounts SET password_hash = ? WHERE account_id = ?");
    $stmt->execute([$passwordHash, $accountId]);

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error resetting password']);
}
