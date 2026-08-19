<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/_autocancel_helper.php';
require_once __DIR__ . '/../admin-auth/require_admin.php';
header('Content-Type: application/json');

try {
    // 1. Run shared 15-minute auto-cancel sweep
    autoCancelLateAppointments($pdo);

    // 2. Status filter handling
    $statusFilter = trim($_GET['status'] ?? 'All Bookings');

    $sql = "
        SELECT 
            a.appointment_id AS id,
            CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) AS customer,
            c.email,
            c.phone,
            GROUP_CONCAT(s.name SEPARATOR ', ') AS service,
            a.appointment_date,
            a.appointment_time,
            a.total_price AS price,
            a.status,
            SUM(s.duration_minutes) AS total_duration_minutes
        FROM appointments a
        JOIN customers c ON a.customer_id = c.customer_id
        JOIN appointment_services aps ON a.appointment_id = aps.appointment_id
        JOIN services s ON aps.service_id = s.service_id
    ";

    $params = [];
    if ($statusFilter !== 'All Bookings' && $statusFilter !== '') {
        $sql .= " WHERE a.status = :status";
        $params[':status'] = $statusFilter;
    }

    $sql .= " GROUP BY a.appointment_id ORDER BY a.appointment_date DESC, a.appointment_time DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 3. Format rows for admin.js compatibility
    $formatted = array_map(function ($row) {
        $timestamp = strtotime($row['appointment_date'] . ' ' . $row['appointment_time']);
        $formattedTime = date('M j, g:i A', $timestamp);

        // Check if date is today for display prefix (matching "Today, 2:00 PM" style if date is today)
        if (date('Y-m-d', $timestamp) === date('Y-m-d')) {
            $formattedTime = 'Today, ' . date('g:i A', $timestamp);
        }

        return [
            'id'               => $row['id'],
            'customer'         => trim($row['customer']) ?: 'Guest Customer',
            'email'            => $row['email'],
            'phone'            => $row['phone'],
            'service'          => $row['service'] ?: 'N/A',
            'time'             => $formattedTime,
            'date'             => $row['appointment_date'],
            'raw_time'         => $row['appointment_time'],
            'price'            => (float)$row['price'],
            'duration_minutes' => (int)$row['total_duration_minutes'],
            'status'           => $row['status']
        ];
    }, $rows);

    echo json_encode($formatted);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error loading appointments']);
}
