<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
header('Content-Type: application/json');

if (isset($_SESSION['admin_id'])) {
    echo json_encode([
        'logged_in' => true,
        'admin' => [
            'id'       => $_SESSION['admin_id'],
            'name'     => $_SESSION['admin_name'] ?? '',
            'username' => $_SESSION['admin_username'] ?? '',
            'role'     => $_SESSION['admin_role'] ?? 'Staff'
        ]
    ]);
} else {
    echo json_encode([
        'logged_in' => false,
        'admin'     => null
    ]);
}
