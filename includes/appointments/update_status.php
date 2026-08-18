<?php
require_once __DIR__ . '/../../config/database.php';
header('Content-Type: application/json');

// TODO: require admin session once Step 9 (Account Management/admin login) is built

$appointmentId = trim($_POST['appointment_id'] ?? '');
$status = trim($_POST['status'] ?? '');

$allowedStatuses = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];

if (!$appointmentId || !in_array($status, $allowedStatuses, true)) {
    echo json_encode(['success' => false, 'error' => 'Invalid status or appointment ID']);
    exit;
}

try {
    $stmt = $pdo->prepare("UPDATE appointments SET status = ? WHERE appointment_id = ?");
    $stmt->execute([$status, $appointmentId]);

    if ($stmt->rowCount() === 0) {
        // Verify if appointment exists
        $chk = $pdo->prepare("SELECT COUNT(*) FROM appointments WHERE appointment_id = ?");
        $chk->execute([$appointmentId]);
        if ($chk->fetchColumn() == 0) {
            echo json_encode(['success' => false, 'error' => 'Appointment not found']);
            exit;
        }
    }

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error updating status']);
}
