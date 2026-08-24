<?php
// includes/auth/register.php
session_start();
require_once __DIR__ . '/../../config/database.php';

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

$otp = sprintf("%06d", mt_rand(1, 999999));

try {
    // Insert into database
    $stmt = $pdo->prepare("
        INSERT INTO customers (first_name, last_name, email, phone, password_hash, email_verified, otp_code) 
        VALUES (?, ?, ?, ?, ?, 0, ?)
    ");
    $stmt->execute([$firstName, $lastName, $email, $phone, $passwordHash, $otp]);
    
    // Auto-login after registration but keep them unverified
    $_SESSION['customer_id'] = $pdo->lastInsertId();
    $_SESSION['first_name'] = $firstName;
    $_SESSION['email'] = $email;
    
    // Send email
    $mailConfig = require __DIR__ . '/../../config/mail.php';
    $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
    
    $mail->isSMTP();
    $mail->Host       = $mailConfig['host'];
    $mail->SMTPAuth   = true;
    $mail->Username   = $mailConfig['username'];
    $mail->Password   = $mailConfig['password'];
    $mail->SMTPSecure = $mailConfig['encryption'];
    $mail->Port       = $mailConfig['port'];

    $mail->setFrom($mailConfig['from_address'], $mailConfig['from_name']);
    $mail->addAddress($email, $firstName . ' ' . $lastName);

    $mail->isHTML(true);
    $mail->Subject = 'Your Verification Code';
    $mail->Body    = "Hello {$firstName},<br><br>Your verification code is: <b>{$otp}</b><br><br>Thank you!";

    $mail->send();
    
    echo json_encode(['success' => true]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Registration successful, but failed to send email: ' . $e->getMessage()]);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'Database error during registration.']);
}
