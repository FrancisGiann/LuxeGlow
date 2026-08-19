<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../admin-auth/require_admin.php';
header('Content-Type: application/json');

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

    // Fetch customer_id for this appointment to send website notification
    $custStmt = $pdo->prepare("SELECT customer_id FROM appointments WHERE appointment_id = ?");
    $custStmt->execute([$appointmentId]);
    $customerId = (int)$custStmt->fetchColumn();

    if ($customerId > 0) {
        require_once __DIR__ . '/../notifications/create.php';
        require_once __DIR__ . '/../email/send_notification.php';

        if ($status === 'Confirmed') {
            createCustomerNotification(
                $pdo,
                $customerId,
                $appointmentId,
                'confirmed',
                'Booking Confirmed',
                "Your appointment (#{$appointmentId}) has been confirmed by our salon team."
            );
            sendAppointmentEmail($pdo, $appointmentId, 'confirmed');
        } elseif ($status === 'Cancelled') {
            createCustomerNotification(
                $pdo,
                $customerId,
                $appointmentId,
                'cancelled',
                'Appointment Cancelled',
                "Your appointment (#{$appointmentId}) has been cancelled."
            );
            sendAppointmentEmail($pdo, $appointmentId, 'cancelled');
        }
    }

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error updating status']);
}
