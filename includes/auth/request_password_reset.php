<?php
// includes/auth/request_password_reset.php
session_start();
require_once __DIR__ . '/../../config/database.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

$genericMessage = 'If an account matches that email, a 6-digit reset code will arrive shortly.';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Invalid request method.']);
    exit;
}

$email = strtolower(trim((string)($_POST['email'] ?? '')));
if ($email === '' || strlen($email) > 255 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'error' => 'Please enter a valid email address.']);
    exit;
}

$customer = null;
$tokenCode = null;

try {
    $pdo->beginTransaction();

    // Lock the customer row so two concurrent requests cannot both create
    // fresh tokens for the same account and bypass the request throttle.
    $stmt = $pdo->prepare('SELECT customer_id, first_name, last_name, email FROM customers WHERE email = ? FOR UPDATE');
    $stmt->execute([$email]);
    $customer = $stmt->fetch();

    if ($customer) {
        $throttleStmt = $pdo->prepare(
            'SELECT reset_id FROM password_reset_tokens
             WHERE customer_id = ? AND created_at > (NOW() - INTERVAL 60 SECOND)
             LIMIT 1 FOR UPDATE'
        );
        $throttleStmt->execute([$customer['customer_id']]);

        if (!$throttleStmt->fetch()) {
            $tokenCode = sprintf('%06d', random_int(0, 999999));
            $tokenHash = password_hash($tokenCode, PASSWORD_DEFAULT);
            if ($tokenHash === false) {
                throw new RuntimeException('Reset code hashing failed.');
            }

            // The table intentionally keeps one current token per customer.
            // Replacing an older token invalidates it immediately.
            $deleteStmt = $pdo->prepare('DELETE FROM password_reset_tokens WHERE customer_id = ?');
            $deleteStmt->execute([$customer['customer_id']]);

            $insertStmt = $pdo->prepare(
                'INSERT INTO password_reset_tokens
                    (customer_id, token_hash, expires_at, attempts)
                 VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE), 0)'
            );
            $insertStmt->execute([$customer['customer_id'], $tokenHash]);
        }
    }

    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Password reset request failed: ' . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Unable to process the request right now.']);
    exit;
}

// Keep mail delivery outside the database transaction. A mail failure is
// intentionally indistinguishable from an unknown address to the caller.
if ($customer && $tokenCode !== null) {
    try {
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
        $mail->addAddress($customer['email'], trim($customer['first_name'] . ' ' . $customer['last_name']));
        $mail->isHTML(true);
        $mail->Subject = 'Your Password Reset Code';
        $firstName = htmlspecialchars((string)$customer['first_name'], ENT_QUOTES, 'UTF-8');
        $mail->Body = "Hello {$firstName},<br><br>Your password reset code is: <b>{$tokenCode}</b><br><br>This code expires in 15 minutes and can only be used once. If you did not request this, you can safely ignore this email.";
        $mail->AltBody = "Your password reset code is {$tokenCode}. It expires in 15 minutes and can only be used once.";
        $mail->send();
    } catch (Throwable $e) {
        error_log('Password reset email failed: ' . $e->getMessage());
    }
}

echo json_encode(['success' => true, 'message' => $genericMessage]);
