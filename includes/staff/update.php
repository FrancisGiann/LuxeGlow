<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../admin-auth/require_super_admin.php';
header('Content-Type: application/json');

$accountId = (int)($_POST['account_id'] ?? 0);
$name = trim($_POST['name'] ?? '');
$position = trim($_POST['position'] ?? '');
$contactNumber = trim($_POST['contact_number'] ?? '');
$email = trim($_POST['email'] ?? '');
$address = trim($_POST['address'] ?? '');
$role = trim($_POST['role'] ?? 'Staff');

if ($accountId <= 0 || !$name || !$position || !$email) {
    echo json_encode(['success' => false, 'error' => 'Account ID, Name, Position, and Email are required.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'error' => 'Invalid email address.']);
    exit;
}

if (!in_array($role, ['Super Admin', 'Staff'])) {
    $role = 'Staff';
}

try {
    // Check email uniqueness excluding current account
    $checkStmt = $pdo->prepare("SELECT account_id FROM staff_accounts WHERE email = ? AND account_id != ?");
    $checkStmt->execute([$email, $accountId]);
    if ($checkStmt->fetch()) {
        echo json_encode(['success' => false, 'error' => 'An account with this email already exists.']);
        exit;
    }

    $stmt = $pdo->prepare("
        UPDATE staff_accounts
        SET name = ?, position = ?, contact_number = ?, email = ?, address = ?, role = ?
        WHERE account_id = ?
    ");
    $stmt->execute([$name, $position, $contactNumber, $email, $address, $role, $accountId]);

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error updating staff account']);
}
