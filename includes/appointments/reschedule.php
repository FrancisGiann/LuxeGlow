<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../admin-auth/require_admin.php';
require_once __DIR__ . '/_overlap_helper.php';
header('Content-Type: application/json');

$appointmentId = trim($_POST['appointment_id'] ?? '');
$newDate = trim($_POST['new_date'] ?? '');
$newTimeStr = trim($_POST['new_time'] ?? '');

if (!$appointmentId || !$newDate || !$newTimeStr) {
    echo json_encode(['success' => false, 'error' => 'Missing reschedule parameters']);
    exit;
}

try {
    // 1. Fetch total duration for this appointment from existing linked services
    $durStmt = $pdo->prepare("
        SELECT SUM(s.duration_minutes) AS total_duration
        FROM appointment_services aps
        JOIN services s ON aps.service_id = s.service_id
        WHERE aps.appointment_id = ?
    ");
    $durStmt->execute([$appointmentId]);
    $totalDuration = (int)$durStmt->fetchColumn();

    if ($totalDuration <= 0) {
        echo json_encode(['success' => false, 'error' => 'Appointment services not found']);
        exit;
    }

    // 2. Re-run overlap check (excluding this appointment from self-conflict)
    $overlapCheck = checkAppointmentOverlap($pdo, $newDate, $newTimeStr, $totalDuration, $appointmentId);
    if ($overlapCheck['has_conflict']) {
        echo json_encode(['success' => false, 'error' => $overlapCheck['reason']]);
        exit;
    }

    $slotStartTimestamp = strtotime($newTimeStr);
    $mysqlTime = date('H:i:s', $slotStartTimestamp);

    // 3. Update appointment date and time
    $upd = $pdo->prepare("UPDATE appointments SET appointment_date = ?, appointment_time = ? WHERE appointment_id = ?");
    $upd->execute([$newDate, $mysqlTime, $appointmentId]);

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error rescheduling appointment']);
}
