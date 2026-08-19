<?php
// includes/customers/my_dashboard.php
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
    // 2. Fetch Customer Info
    $custStmt = $pdo->prepare("
        SELECT customer_id AS id, first_name, last_name, email, phone, created_at 
        FROM customers 
        WHERE customer_id = ?
    ");
    $custStmt->execute([$customerId]);
    $customer = $custStmt->fetch(PDO::FETCH_ASSOC);

    if (!$customer) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Customer profile not found']);
        exit;
    }

    // 3. Fetch Appointments with Rating Info
    $appStmt = $pdo->prepare("
        SELECT 
            a.appointment_id AS id,
            a.appointment_date,
            a.appointment_time,
            a.total_price AS price,
            a.status,
            a.created_at,
            GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ', ') AS service,
            r.review_id,
            r.rating AS rating_given,
            r.review_text
        FROM appointments a
        JOIN appointment_services aps ON a.appointment_id = aps.appointment_id
        JOIN services s ON aps.service_id = s.service_id
        LEFT JOIN reviews r ON a.appointment_id = r.appointment_id
        WHERE a.customer_id = ?
        GROUP BY a.appointment_id
        ORDER BY a.appointment_date DESC, a.appointment_time DESC
    ");
    $appStmt->execute([$customerId]);
    $appointmentsRaw = $appStmt->fetchAll(PDO::FETCH_ASSOC);

    $formattedAppointments = array_map(function ($row) {
        $ts = strtotime($row['appointment_date'] . ' ' . $row['appointment_time']);
        return [
            'id'           => $row['id'],
            'date'         => date('M j, Y', $ts),
            'time'         => date('g:i A', $ts),
            'raw_date'     => $row['appointment_date'],
            'raw_time'     => $row['appointment_time'],
            'service'      => $row['service'] ?: 'N/A',
            'price'        => (float)$row['price'],
            'status'       => $row['status'],
            'has_rating'   => !empty($row['review_id']),
            'rating_given' => $row['rating_given'] ? (int)$row['rating_given'] : null,
            'review_text'  => $row['review_text'] ?: ''
        ];
    }, $appointmentsRaw);

    // 4. Calculate Summary Counters
    $pendingCount   = 0;
    $confirmedCount = 0;
    $completedCount = 0;
    $cancelledCount = 0;

    foreach ($formattedAppointments as $app) {
        switch ($app['status']) {
            case 'Pending':   $pendingCount++; break;
            case 'Confirmed': $confirmedCount++; break;
            case 'Completed': $completedCount++; break;
            case 'Cancelled': $cancelledCount++; break;
        }
    }

    // 5. Fetch Notifications
    $notifStmt = $pdo->prepare("
        SELECT id, appointment_id, type, title, message, is_read, created_at
        FROM user_notifications
        WHERE customer_id = ?
        ORDER BY created_at DESC
        LIMIT 30
    ");
    $notifStmt->execute([$customerId]);
    $notifications = $notifStmt->fetchAll(PDO::FETCH_ASSOC);

    $unreadNotifCount = 0;
    $formattedNotifs = array_map(function ($n) use (&$unreadNotifCount) {
        $isRead = (bool)$n['is_read'];
        if (!$isRead) $unreadNotifCount++;
        return [
            'id'             => (int)$n['id'],
            'appointment_id' => $n['appointment_id'],
            'type'           => $n['type'],
            'title'          => $n['title'],
            'message'        => $n['message'],
            'is_read'        => $isRead,
            'created_at'     => date('M j, g:i A', strtotime($n['created_at']))
        ];
    }, $notifications);

    // 6. Fetch Customer Reviews
    $revStmt = $pdo->prepare("
        SELECT r.review_id, r.appointment_id, r.rating, r.review_text, r.created_at,
               GROUP_CONCAT(s.name SEPARATOR ', ') AS service_names
        FROM reviews r
        JOIN appointments a ON r.appointment_id = a.appointment_id
        LEFT JOIN appointment_services aps ON a.appointment_id = aps.appointment_id
        LEFT JOIN services s ON aps.service_id = s.service_id
        WHERE r.customer_id = ?
        GROUP BY r.review_id
        ORDER BY r.created_at DESC
    ");
    $revStmt->execute([$customerId]);
    $reviewsRaw = $revStmt->fetchAll(PDO::FETCH_ASSOC);

    $formattedReviews = array_map(function ($r) {
        return [
            'review_id'      => (int)$r['review_id'],
            'appointment_id' => $r['appointment_id'],
            'rating'         => (int)$r['rating'],
            'review_text'    => $r['review_text'] ?: '',
            'service_names'  => $r['service_names'] ?: 'Beauty Service',
            'created_at'     => date('M j, Y', strtotime($r['created_at']))
        ];
    }, $reviewsRaw);

    echo json_encode([
        'success'      => true,
        'customer'     => [
            'id'         => (int)$customer['id'],
            'first_name' => $customer['first_name'],
            'last_name'  => $customer['last_name'],
            'full_name'  => trim($customer['first_name'] . ' ' . ($customer['last_name'] ?? '')),
            'email'      => $customer['email'],
            'phone'      => $customer['phone'],
            'joined_at'  => date('M Y', strtotime($customer['created_at']))
        ],
        'summary'      => [
            'pending_count'          => $pendingCount,
            'confirmed_count'        => $confirmedCount,
            'completed_count'        => $completedCount,
            'cancelled_count'        => $cancelledCount,
            'unread_notifications'   => $unreadNotifCount
        ],
        'appointments'  => $formattedAppointments,
        'notifications' => $formattedNotifs,
        'reviews'       => $formattedReviews
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error loading customer dashboard']);
}
