<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
require_once __DIR__ . '/../../config/database.php';
header('Content-Type: application/json');

// 1. Customer authentication check
if (!isset($_SESSION['customer_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not logged in']);
    exit;
}

$customerId = (int)$_SESSION['customer_id'];

try {
    // 2. Fetch Completed appointments for this customer that do NOT have a review yet
    $sql = "
        SELECT 
            a.appointment_id,
            a.appointment_date,
            a.appointment_time,
            a.total_price,
            GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ', ') AS service_names
        FROM appointments a
        JOIN appointment_services aps ON a.appointment_id = aps.appointment_id
        JOIN services s ON aps.service_id = s.service_id
        LEFT JOIN reviews r ON a.appointment_id = r.appointment_id
        WHERE a.customer_id = :customer_id
          AND a.status = 'Completed'
          AND r.review_id IS NULL
        GROUP BY a.appointment_id, a.appointment_date, a.appointment_time, a.total_price
        ORDER BY a.appointment_date DESC, a.appointment_time DESC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([':customer_id' => $customerId]);
    $appointments = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Format date/time nicely for display
    $formatted = array_map(function ($item) {
        $timeFormatted = date('g:i A', strtotime($item['appointment_time']));
        return [
            'appointment_id'   => $item['appointment_id'],
            'appointment_date' => $item['appointment_date'],
            'appointment_time' => $timeFormatted,
            'service_names'    => $item['service_names'],
            'total_price'      => (float)$item['total_price']
        ];
    }, $appointments);

    echo json_encode([
        'success'      => true,
        'appointments' => $formatted
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error while fetching ratable appointments']);
}
