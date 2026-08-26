<?php
// includes/auth/resend_otp.php
session_start();
require_once __DIR__ . '/../../config/database.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

const OTP_RESEND_COOLDOWN_SECONDS = 60;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Invalid request method.']);
    exit;
}

$customerId = filter_var($_SESSION['customer_id'] ?? null, FILTER_VALIDATE_INT);
if ($customerId === false || $customerId < 1) {
    echo json_encode(['success' => false, 'error' => 'Not logged in.']);
    exit;
}

$otp = null;
$customer = null;

try {
    $pdo->beginTransaction();

    // Lock the customer row for the complete cooldown/check/replace
    // operation. Concurrent resend requests therefore cannot both pass the
    // cooldown check or leave different codes in flight.
    $stmt = $pdo->prepare(
        'SELECT customer_id, first_name, last_name, email, email_verified,
                otp_code, otp_last_sent_at
         FROM customers
         WHERE customer_id = ?
         LIMIT 1
         FOR UPDATE'
    );
    $stmt->execute([$customerId]);
    $customer = $stmt->fetch();

    if (!$customer) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => 'Not logged in.']);
        exit;
    }

    if ((int)$customer['email_verified'] === 1) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => 'This account is already verified.']);
        exit;
    }

    if ($customer['otp_last_sent_at'] !== null) {
        $cooldownStmt = $pdo->prepare(
            'SELECT GREATEST(
                0,
                TIMESTAMPDIFF(
                    SECOND,
                    NOW(),
                    DATE_ADD(otp_last_sent_at, INTERVAL ' . OTP_RESEND_COOLDOWN_SECONDS . ' SECOND)
                )
             ) AS retry_after
             FROM customers
             WHERE customer_id = ?'
        );
        $cooldownStmt->execute([$customerId]);
        $retryAfter = (int)$cooldownStmt->fetchColumn();

        if ($retryAfter > 0) {
            $pdo->rollBack();
            echo json_encode([
                'success' => false,
                'error' => 'Please wait before requesting another code.',
                'retry_after' => $retryAfter,
                'remaining' => $retryAfter,
            ]);
            exit;
        }
    }

    $currentOtp = is_string($customer['otp_code']) ? $customer['otp_code'] : null;
    $otp = sprintf('%06d', random_int(0, 999999));
    if ($currentOtp !== null && preg_match('/\A[0-9]{6}\z/D', $currentOtp) === 1 && $otp === $currentOtp) {
        // Keep the replacement cryptographically random in the normal case,
        // but guarantee rotation if the random draw happens to collide.
        $otpNumber = ((int)$otp + 1) % 1000000;
        $otp = sprintf('%06d', $otpNumber);
    }
    $updateStmt = $pdo->prepare(
        'UPDATE customers
         SET otp_code = ?,
             otp_expires_at = DATE_ADD(NOW(), INTERVAL 15 MINUTE),
             otp_last_sent_at = NOW()
         WHERE customer_id = ? AND email_verified = 0'
    );
    $updateStmt->execute([$otp, $customerId]);

    if ($updateStmt->rowCount() !== 1) {
        throw new RuntimeException('Verification code could not be saved.');
    }

    $pdo->commit();
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('OTP resend database error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Database error while preparing the verification code.']);
    exit;
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('OTP resend failed: ' . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Unable to prepare a new verification code.']);
    exit;
}

try {
    // Keep mail delivery outside the transaction. The replacement above
    // intentionally invalidates the previous code even if delivery fails.
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
    $mail->Subject = 'Your New Verification Code';
    $safeFirstName = htmlspecialchars((string)$customer['first_name'], ENT_QUOTES, 'UTF-8');
    $mail->Body    = "Hello {$safeFirstName},<br><br>Your new verification code is: <b>{$otp}</b><br><br>This code expires in 15 minutes. If you did not request this, you can safely ignore this email.";
    $mail->AltBody = "Your new verification code is {$otp}. This code expires in 15 minutes.";

    $mail->send();
} catch (Throwable $e) {
    error_log('OTP resend email failed: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'error' => 'The new verification code was saved, but the email could not be sent. Please try again later.',
        'retry_after' => OTP_RESEND_COOLDOWN_SECONDS,
        'remaining' => OTP_RESEND_COOLDOWN_SECONDS,
    ]);
    exit;
}

echo json_encode([
    'success' => true,
    'retry_after' => OTP_RESEND_COOLDOWN_SECONDS,
    'remaining' => OTP_RESEND_COOLDOWN_SECONDS,
]);
