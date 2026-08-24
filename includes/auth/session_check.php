<?php
// includes/auth/session_check.php
session_start();

header('Content-Type: application/json');

require_once __DIR__ . '/../../config/database.php';

if (isset($_SESSION['customer_id'])) {
    $stmt = $pdo->prepare("SELECT email_verified FROM customers WHERE customer_id = ?");
    $stmt->execute([$_SESSION['customer_id']]);
    $verified = $stmt->fetchColumn();

    if ($verified) {
        echo json_encode([
            'loggedIn' => true,
            'customer' => [
                'id' => $_SESSION['customer_id'],
                'first_name' => $_SESSION['first_name'],
                'email' => $_SESSION['email']
            ]
        ]);
        exit;
    }
}

echo json_encode(['loggedIn' => false]);
