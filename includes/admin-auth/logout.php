<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

unset($_SESSION['admin_id']);
unset($_SESSION['admin_name']);
unset($_SESSION['admin_username']);
unset($_SESSION['admin_role']);

if (isset($_GET['json'])) {
    header('Content-Type: application/json');
    echo json_encode(['success' => true]);
    exit;
}

header('Location: ../../index.php');
exit;
