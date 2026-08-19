<?php
session_start();
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/_overlap_helper.php';
header('Content-Type: application/json');

// 1. Check if user is logged in
if (!isset($_SESSION['customer_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not logged in']);
    exit;
}

$customerId = (int)$_SESSION['customer_id'];

// 2. Read POST payload
$serviceIds = $_POST['service_ids'] ?? [];
if (is_string($serviceIds)) {
    $serviceIds = json_decode($serviceIds, true) ?? [];
}
$date = trim($_POST['date'] ?? '');
$timeStr = trim($_POST['time'] ?? '');

if (empty($serviceIds) || !$date || !$timeStr) {
    echo json_encode(['success' => false, 'error' => 'Missing required booking details']);
    exit;
}

try {
    // 3. Re-fetch services from database to calculate server-side price and duration
    $inClause = implode(',', array_fill(0, count($serviceIds), '?'));
    $stmt = $pdo->prepare("SELECT service_id, price, duration_minutes FROM services WHERE service_id IN ($inClause)");
    $stmt->execute($serviceIds);
    $services = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (count($services) !== count($serviceIds)) {
        echo json_encode(['success' => false, 'error' => 'Invalid services selected']);
        exit;
    }

    $totalPrice = 0;
    $totalDuration = 0;
    foreach ($services as $s) {
        $totalPrice += (float)$s['price'];
        $totalDuration += (int)$s['duration_minutes'];
    }

    // 4. Double-check for conflicts server-side using shared overlap helper
    $overlapCheck = checkAppointmentOverlap($pdo, $date, $timeStr, $totalDuration);
    if ($overlapCheck['has_conflict']) {
        echo json_encode(['success' => false, 'error' => 'That time is no longer available. Please choose another slot.']);
        exit;
    }

    $slotStartTimestamp = strtotime($timeStr);
    $mysqlTime = date('H:i:s', $slotStartTimestamp);

    // 5. Generate BK-#### appointment_id (max + 1) inside transaction
    $pdo->beginTransaction();

    $idStmt = $pdo->query("SELECT MAX(CAST(SUBSTRING(appointment_id, 4) AS UNSIGNED)) FROM appointments");
    $maxNum = (int)$idStmt->fetchColumn();
    $nextNum = $maxNum > 0 ? $maxNum + 1 : 1000;
    $appointmentId = 'BK-' . $nextNum;

    // 6. Insert into appointments
    $insApp = $pdo->prepare("
        INSERT INTO appointments (appointment_id, customer_id, appointment_date, appointment_time, total_price, status)
        VALUES (?, ?, ?, ?, ?, 'Pending')
    ");
    $insApp->execute([$appointmentId, $customerId, $date, $mysqlTime, $totalPrice]);

    // 7. Insert into appointment_services
    $insSrv = $pdo->prepare("INSERT INTO appointment_services (appointment_id, service_id) VALUES (?, ?)");
    foreach ($serviceIds as $srvId) {
        $insSrv->execute([$appointmentId, $srvId]);
    }

    $pdo->commit();

    // 8. Trigger website notification and email after transaction commits
    require_once __DIR__ . '/../notifications/create.php';
    require_once __DIR__ . '/../email/send_notification.php';

    createCustomerNotification(
        $pdo,
        $customerId,
        $appointmentId,
        'pending',
        'Booking Received',
        "Your booking request (#{$appointmentId}) has been received and is currently Pending approval."
    );

    sendAppointmentEmail($pdo, $appointmentId, 'pending');

    echo json_encode(['success' => true, 'appointment_id' => $appointmentId]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode(['success' => false, 'error' => 'Database error while saving booking']);
}
