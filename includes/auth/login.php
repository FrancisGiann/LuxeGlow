<?php
// includes/auth/login.php
session_start();
require_once '../../config/database.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Invalid request method.']);
    exit;
}

$email = trim($_POST['email'] ?? '');
$password = $_POST['password'] ?? '';

if (!$email || !$password) {
    echo json_encode(['success' => false, 'error' => 'Email and password are required.']);
    exit;
}

$stmt = $pdo->prepare("SELECT customer_id, first_name, password_hash FROM customers WHERE email = ?");
$stmt->execute([$email]);
$user = $stmt->fetch();

if ($user && password_verify($password, $user['password_hash'])) {
    $_SESSION['customer_id'] = $user['customer_id'];
    $_SESSION['first_name'] = $user['first_name'];
    $_SESSION['email'] = $email;
    
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'error' => 'Invalid email or password.']);
}
