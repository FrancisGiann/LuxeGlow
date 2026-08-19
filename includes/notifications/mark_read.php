<?php
// includes/notifications/mark_read.php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
require_once __DIR__ . '/../../config/database.php';
header('Content-Type: application/json');

if (!isset($_SESSION['customer_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not logged in']);
    exit;
}

$customerId = (int)$_SESSION['customer_id'];
$notifId    = (int)($_POST['notification_id'] ?? 0);
$markAll    = isset($_POST['mark_all']) && $_POST['mark_all'] == '1';

try {
    if ($markAll) {
        $stmt = $pdo->prepare("UPDATE user_notifications SET is_read = 1 WHERE customer_id = ?");
        $stmt->execute([$customerId]);
    } elseif ($notifId > 0) {
        $stmt = $pdo->prepare("UPDATE user_notifications SET is_read = 1 WHERE id = ? AND customer_id = ?");
        $stmt->execute([$notifId, $customerId]);
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid parameters']);
        exit;
    }

    echo json_encode(['success' => true]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error updating notification status']);
}
