<?php
// includes/auth/resend_otp.php
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

$otp = sprintf("%06d", mt_rand(1, 999999));

try {
    $stmt = $pdo->prepare("UPDATE customers SET otp_code = ? WHERE customer_id = ?");
    $stmt->execute([$otp, $_SESSION['customer_id']]);
} catch (PDOException $e) {
    error_log('OTP resend database error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Database error while preparing the verification code.']);
    exit;
} catch (Throwable $e) {
    error_log('OTP resend failed: ' . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Unable to prepare a new verification code.']);
    exit;
}

try {
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
    $mail->addAddress($_SESSION['email'], $_SESSION['first_name']);

    $mail->isHTML(true);
    $mail->Subject = 'Your New Verification Code';
    $mail->Body    = "Hello {$_SESSION['first_name']},<br><br>Your new verification code is: <b>{$otp}</b><br><br>Thank you!";

    $mail->send();
} catch (Throwable $e) {
    error_log('OTP resend email failed: ' . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'The new verification code was saved, but the email could not be sent. Please try again.']);
    exit;
}

echo json_encode(['success' => true]);
