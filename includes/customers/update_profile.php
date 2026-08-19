<?php
// includes/customers/update_profile.php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
require_once __DIR__ . '/../../config/database.php';
header('Content-Type: application/json');

if (!isset($_SESSION['customer_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not logged in']);
    exit;
}

$customerId = (int)$_SESSION['customer_id'];
$firstName  = trim($_POST['first_name'] ?? '');
$lastName   = trim($_POST['last_name'] ?? '');
$phone      = trim($_POST['phone'] ?? '');
$newPassword= $_POST['new_password'] ?? '';

if (!$firstName || !$phone) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'First name and phone number are required']);
    exit;
}

try {
    if (!empty($newPassword)) {
        if (strlen($newPassword) < 8) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'New password must be at least 8 characters']);
            exit;
        }
        $passHash = password_hash($newPassword, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("
            UPDATE customers 
            SET first_name = :first_name, last_name = :last_name, phone = :phone, password_hash = :pass_hash 
            WHERE customer_id = :cust_id
        ");
        $stmt->execute([
            ':first_name' => $firstName,
            ':last_name'  => $lastName ?: null,
            ':phone'      => $phone,
            ':pass_hash'  => $passHash,
            ':cust_id'    => $customerId
        ]);
    } else {
        $stmt = $pdo->prepare("
            UPDATE customers 
            SET first_name = :first_name, last_name = :last_name, phone = :phone 
            WHERE customer_id = :cust_id
        ");
        $stmt->execute([
            ':first_name' => $firstName,
            ':last_name'  => $lastName ?: null,
            ':phone'      => $phone,
            ':cust_id'    => $customerId
        ]);
    }

    // Update session first name if changed
    $_SESSION['first_name'] = $firstName;

    echo json_encode([
        'success' => true,
        'message' => 'Profile updated successfully!',
        'customer' => [
            'first_name' => $firstName,
            'last_name'  => $lastName,
            'phone'      => $phone
        ]
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error updating profile']);
}
