<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../admin-auth/require_admin.php';
header('Content-Type: application/json');

$service_id = trim($_POST['service_id'] ?? '');
if (!$service_id) {
    echo json_encode(['success' => false, 'error' => 'Missing service_id']);
    exit;
}

try {
    $stmt = $pdo->prepare("DELETE FROM services WHERE service_id=?");
    $stmt->execute([$service_id]);
    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'Database error']);
}
