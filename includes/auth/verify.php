<?php
// includes/auth/verify.php
session_start();
require_once __DIR__ . '/../../config/database.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Invalid request method.']);
    exit;
}

if (!isset($_SESSION['customer_id'])) {
    echo json_encode(['success' => false, 'error' => 'Not logged in.']);
    exit;
}

$otpInput = trim($_POST['otp'] ?? '');
if (!$otpInput) {
    echo json_encode(['success' => false, 'error' => 'OTP is required.']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT otp_code FROM customers WHERE customer_id = ?");
    $stmt->execute([$_SESSION['customer_id']]);
    $user = $stmt->fetch();

    if (!$user || $user['otp_code'] !== $otpInput) {
        echo json_encode(['success' => false, 'error' => 'Invalid OTP.']);
        exit;
    }

    // OTP matches, mark as verified
    $stmt = $pdo->prepare("UPDATE customers SET email_verified = 1, otp_code = NULL WHERE customer_id = ?");
    $stmt->execute([$_SESSION['customer_id']]);

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'Database error.']);
}
