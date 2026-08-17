<?php
session_start();
require_once __DIR__ . '/../../config/database.php';
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

    // 4. Double-check for conflicts server-side (prevent race conditions)
    $slotStartTimestamp = strtotime($timeStr);
    $slotStartSeconds = (date('H', $slotStartTimestamp) * 3600) + (date('i', $slotStartTimestamp) * 60);
    $slotEndSeconds = $slotStartSeconds + ($totalDuration * 60);
    $closingTimeSeconds = 20 * 3600;

    if ($slotEndSeconds > $closingTimeSeconds) {
        echo json_encode(['success' => false, 'error' => 'That time is no longer available. Please choose another slot.']);
        exit;
    }

    $checkStmt = $pdo->prepare("
        SELECT 
            a.appointment_time AS start_time,
            ADDTIME(a.appointment_time, SEC_TO_TIME(SUM(s.duration_minutes) * 60)) AS end_time
        FROM appointments a
        JOIN appointment_services aps ON a.appointment_id = aps.appointment_id
        JOIN services s ON aps.service_id = s.service_id
        WHERE a.appointment_date = :date
          AND a.status IN ('Pending', 'Confirmed')
        GROUP BY a.appointment_id, a.appointment_time
    ");
    $checkStmt->execute([':date' => $date]);
    $existingApps = $checkStmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($existingApps as $app) {
        $appStartParts = explode(':', $app['start_time']);
        $appStartSeconds = ($appStartParts[0] * 3600) + ($appStartParts[1] * 60);
        $appEndParts = explode(':', $app['end_time']);
        $appEndSeconds = ($appEndParts[0] * 3600) + ($appEndParts[1] * 60);

        if ($slotStartSeconds < $appEndSeconds && $slotEndSeconds > $appStartSeconds) {
            echo json_encode(['success' => false, 'error' => 'That time is no longer available. Please choose another slot.']);
            exit;
        }
    }

    // 5. Generate BK-#### appointment_id (max + 1) inside transaction
    $pdo->beginTransaction();

    $idStmt = $pdo->query("SELECT MAX(CAST(SUBSTRING(appointment_id, 4) AS UNSIGNED)) FROM appointments");
    $maxNum = (int)$idStmt->fetchColumn();
    $nextNum = $maxNum > 0 ? $maxNum + 1 : 1000;
    $appointmentId = 'BK-' . $nextNum;

    $mysqlTime = date('H:i:s', $slotStartTimestamp);

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
    echo json_encode(['success' => true, 'appointment_id' => $appointmentId]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode(['success' => false, 'error' => 'Database error while saving booking']);
}
