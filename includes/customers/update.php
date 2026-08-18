<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../admin-auth/require_admin.php';
header('Content-Type: application/json');

$customerId = (int)($_POST['customer_id'] ?? 0);
$firstName = trim($_POST['first_name'] ?? '');
$lastName = trim($_POST['last_name'] ?? '');
$email = trim($_POST['email'] ?? '');
$phone = trim($_POST['phone'] ?? '');

if ($customerId <= 0 || !$firstName || !$lastName || !$email || !$phone) {
    echo json_encode(['success' => false, 'error' => 'All fields (First Name, Last Name, Email, Phone) are required.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'error' => 'Please enter a valid email address.']);
    exit;
}

try {
    // Check if email belongs to another customer
    $emailChk = $pdo->prepare("SELECT COUNT(*) FROM customers WHERE email = ? AND customer_id != ?");
    $emailChk->execute([$email, $customerId]);
    if ($emailChk->fetchColumn() > 0) {
        echo json_encode(['success' => false, 'error' => 'That email is already in use by another customer.']);
        exit;
    }

    // Update customer info
    $stmt = $pdo->prepare("
        UPDATE customers 
        SET first_name = ?, last_name = ?, email = ?, phone = ? 
        WHERE customer_id = ?
    ");
    $stmt->execute([$firstName, $lastName, $email, $phone, $customerId]);

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error updating customer contact info']);
}
