<?php
// includes/auth/session_check.php
session_start();

header('Content-Type: application/json');

if (isset($_SESSION['customer_id'])) {
    echo json_encode([
        'loggedIn' => true,
        'customer' => [
            'id' => $_SESSION['customer_id'],
            'first_name' => $_SESSION['first_name'],
            'email' => $_SESSION['email']
        ]
    ]);
} else {
    echo json_encode(['loggedIn' => false]);
}
