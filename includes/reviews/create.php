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

// 2. Read POST payload
$appointmentId = trim($_POST['appointment_id'] ?? '');
$rating        = (int)($_POST['rating'] ?? 0);
$reviewText    = trim($_POST['review_text'] ?? '');

if (!$appointmentId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Please select an appointment to rate.']);
    exit;
}

// 3. Application-level validation for rating 1-5
if ($rating < 1 || $rating > 5) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Rating must be between 1 and 5 stars.']);
    exit;
}

try {
    // 4. Verify appointment actually belongs to logged-in customer AND has status 'Completed'
    $appStmt = $pdo->prepare("
        SELECT appointment_id, status 
        FROM appointments 
        WHERE appointment_id = :app_id AND customer_id = :customer_id
    ");
    $appStmt->execute([
        ':app_id'      => $appointmentId,
        ':customer_id' => $customerId
    ]);
    $appointment = $appStmt->fetch(PDO::FETCH_ASSOC);

    if (!$appointment) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Appointment not found or does not belong to you.']);
        exit;
    }

    if ($appointment['status'] !== 'Completed') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'You can only rate completed appointments.']);
        exit;
    }

    // 5. Verify the appointment does not already have a review (prevent duplicates)
    $revCheckStmt = $pdo->prepare("SELECT review_id FROM reviews WHERE appointment_id = :app_id");
    $revCheckStmt->execute([':app_id' => $appointmentId]);
    if ($revCheckStmt->fetch()) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'You have already submitted a review for this appointment.']);
        exit;
    }

    // 6. Insert review
    $insStmt = $pdo->prepare("
        INSERT INTO reviews (customer_id, appointment_id, rating, review_text)
        VALUES (:customer_id, :appointment_id, :rating, :review_text)
    ");
    $insStmt->execute([
        ':customer_id'    => $customerId,
        ':appointment_id' => $appointmentId,
        ':rating'         => $rating,
        ':review_text'    => $reviewText ?: null
    ]);

    echo json_encode([
        'success'   => true,
        'message'   => 'Thank you for your feedback!',
        'review_id' => (int)$pdo->lastInsertId()
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error while saving review']);
}
