<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../admin-auth/require_super_admin.php';
header('Content-Type: application/json');

$accountId = (int)($_POST['account_id'] ?? 0);

if ($accountId <= 0) {
    echo json_encode(['success' => false, 'error' => 'Invalid account ID.']);
    exit;
}

// Block self-deactivation
if ($accountId === (int)$_SESSION['admin_id']) {
    echo json_encode(['success' => false, 'error' => 'You cannot deactivate your own currently logged-in account.']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT status FROM staff_accounts WHERE account_id = ?");
    $stmt->execute([$accountId]);
    $currentStatus = $stmt->fetchColumn();

    if (!$currentStatus) {
        echo json_encode(['success' => false, 'error' => 'Staff account not found.']);
        exit;
    }

    $newStatus = ($currentStatus === 'Active') ? 'Inactive' : 'Active';

    $updateStmt = $pdo->prepare("UPDATE staff_accounts SET status = ? WHERE account_id = ?");
    $updateStmt->execute([$newStatus, $accountId]);

    echo json_encode(['success' => true, 'new_status' => $newStatus]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error toggling staff status']);
}
