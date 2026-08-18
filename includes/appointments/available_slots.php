<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/_overlap_helper.php';
header('Content-Type: application/json');

$date = trim($_REQUEST['date'] ?? '');
$duration_minutes = (int)($_REQUEST['duration_minutes'] ?? 0);
$exclude_id = trim($_REQUEST['exclude_id'] ?? '');

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
    $result = [];

    foreach ($timeSlots as $slotStr) {
        $overlapCheck = checkAppointmentOverlap($pdo, $date, $slotStr, $duration_minutes, $exclude_id ?: null);
        $result[] = [
            'time' => $slotStr,
            'available' => !$overlapCheck['has_conflict']
        ];
    }

    echo json_encode($result);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error']);
}
