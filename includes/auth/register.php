<?php
// includes/auth/register.php
session_start();
require_once '../../config/database.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Invalid request method.']);
    exit;
}

$firstName = trim($_POST['first_name'] ?? '');
$lastName = trim($_POST['last_name'] ?? '');
$email = trim($_POST['email'] ?? '');
$phone = trim($_POST['phone'] ?? '');
$password = $_POST['password'] ?? '';
$confirmPassword = $_POST['confirm_password'] ?? '';

// Validation
if (!$firstName || !$lastName || !$email || !$phone || !$password || !$confirmPassword) {
    echo json_encode(['success' => false, 'error' => 'All fields are required.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'error' => 'Invalid email format.']);
    exit;
}

if ($password !== $confirmPassword) {
    echo json_encode(['success' => false, 'error' => 'Passwords do not match.']);
    exit;
}

if (strlen($password) < 8) {
    echo json_encode(['success' => false, 'error' => 'Password must be at least 8 characters.']);
    exit;
}

// Check if email exists
$stmt = $pdo->prepare("SELECT customer_id FROM customers WHERE email = ?");
$stmt->execute([$email]);
if ($stmt->fetch()) {
    echo json_encode(['success' => false, 'error' => 'Email is already registered.']);
    exit;
}

// Hash password
$passwordHash = password_hash($password, PASSWORD_DEFAULT);

// Insert into database
// TODO: replace with real email OTP in Step 11 (set email_verified = 0 initially)
$stmt = $pdo->prepare("
    INSERT INTO customers (first_name, last_name, email, phone, password_hash, email_verified) 
    VALUES (?, ?, ?, ?, ?, 1)
");

try {
    $stmt->execute([$firstName, $lastName, $email, $phone, $passwordHash]);
    
    // Auto-login after registration
    $_SESSION['customer_id'] = $pdo->lastInsertId();
    $_SESSION['first_name'] = $firstName;
    $_SESSION['email'] = $email;
    
    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'Database error during registration.']);
}
