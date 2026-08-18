<?php
require_once __DIR__ . '/../../config/database.php';
header('Content-Type: application/json');

// TODO: require admin session once Step 9 (Account Management/admin login) is built

$customerId = (int)($_GET['customer_id'] ?? 0);

if ($customerId <= 0) {
    echo json_encode(['success' => false, 'error' => 'Invalid customer ID']);
    exit;
}

try {
    // 1. Fetch customer info
    $custStmt = $pdo->prepare("SELECT customer_id AS id, first_name, last_name, email, phone FROM customers WHERE customer_id = ?");
    $custStmt->execute([$customerId]);
    $customer = $custStmt->fetch(PDO::FETCH_ASSOC);

    if (!$customer) {
        echo json_encode(['success' => false, 'error' => 'Customer not found']);
        exit;
    }

    $customer['name'] = trim($customer['first_name'] . ' ' . $customer['last_name']);

    // 2. Fetch full appointment history (most recent first)
    $appStmt = $pdo->prepare("
        SELECT 
            a.appointment_id AS id,
            a.appointment_date,
            a.appointment_time,
            a.total_price AS price,
            a.status,
            GROUP_CONCAT(s.name SEPARATOR ', ') AS service
        FROM appointments a
        JOIN appointment_services aps ON a.appointment_id = aps.appointment_id
        JOIN services s ON aps.service_id = s.service_id
        WHERE a.customer_id = ?
        GROUP BY a.appointment_id
        ORDER BY a.appointment_date DESC, a.appointment_time DESC
    ");
    $appStmt->execute([$customerId]);
    $appointments = $appStmt->fetchAll(PDO::FETCH_ASSOC);

    $formattedAppointments = array_map(function ($app) {
        $ts = strtotime($app['appointment_date'] . ' ' . $app['appointment_time']);
        return [
            'id'       => $app['id'],
            'date'     => date('F j, Y', $ts),
            'time'     => date('g:i A', $ts),
            'service'  => $app['service'] ?: 'N/A',
            'price'    => (float)$app['price'],
            'status'   => $app['status']
        ];
    }, $appointments);

    echo json_encode([
        'success'      => true,
        'customer'     => $customer,
        'appointments' => $formattedAppointments
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error loading customer detail']);
}
