<?php
require_once __DIR__ . '/../../config/database.php';
header('Content-Type: application/json');

$date = trim($_REQUEST['date'] ?? '');
$duration_minutes = (int)($_REQUEST['duration_minutes'] ?? 0);

if (!$date || $duration_minutes <= 0) {
    echo json_encode(['success' => false, 'error' => 'Invalid parameters']);
    exit;
}

$timeSlots = [
    "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
    "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM",
    "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM"
];

try {
    // Query existing Pending or Confirmed appointments on that date with total duration
    $stmt = $pdo->prepare("
        SELECT 
            a.appointment_id,
            a.appointment_time AS start_time,
            ADDTIME(a.appointment_time, SEC_TO_TIME(SUM(s.duration_minutes) * 60)) AS end_time
        FROM appointments a
        JOIN appointment_services aps ON a.appointment_id = aps.appointment_id
        JOIN services s ON aps.service_id = s.service_id
        WHERE a.appointment_date = :date
          AND a.status IN ('Pending', 'Confirmed')
        GROUP BY a.appointment_id, a.appointment_time
    ");
    $stmt->execute([':date' => $date]);
    $existing = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Business closing time boundary: 8:00 PM (20:00:00)
    $closingTimeSeconds = 20 * 3600;
    $result = [];

    foreach ($timeSlots as $slotStr) {
        $slotStartTimestamp = strtotime($slotStr);
        $slotStartSeconds = (date('H', $slotStartTimestamp) * 3600) + (date('i', $slotStartTimestamp) * 60);
        $slotEndSeconds = $slotStartSeconds + ($duration_minutes * 60);

        $isAvailable = true;

        // 1. Check if appointment duration runs past closing time
        if ($slotEndSeconds > $closingTimeSeconds) {
            $isAvailable = false;
        } else {
            // 2. Check for overlap with existing bookings: startN < endA AND endN > startA
            foreach ($existing as $app) {
                $appStartParts = explode(':', $app['start_time']);
                $appStartSeconds = ($appStartParts[0] * 3600) + ($appStartParts[1] * 60);

                $appEndParts = explode(':', $app['end_time']);
                $appEndSeconds = ($appEndParts[0] * 3600) + ($appEndParts[1] * 60);

                if ($slotStartSeconds < $appEndSeconds && $slotEndSeconds > $appStartSeconds) {
                    $isAvailable = false;
                    break;
                }
            }
        }

        $result[] = [
            'time' => $slotStr,
            'available' => $isAvailable
        ];
    }

    echo json_encode($result);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error']);
}
