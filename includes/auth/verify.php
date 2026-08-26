<?php
// includes/auth/verify.php
session_start();
require_once __DIR__ . '/../../config/database.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

$invalidCodeMessage = 'Invalid verification code.';
$expiredCodeMessage = 'This verification code has expired. Please request a new code.';

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

// Do not coerce or partially accept values: the verification code is exactly
// six ASCII digits, including leading zeroes.
$otpInput = is_string($_POST['otp'] ?? null) ? $_POST['otp'] : '';
if (!preg_match('/\A[0-9]{6}\z/D', $otpInput)) {
    echo json_encode(['success' => false, 'error' => $invalidCodeMessage]);
    exit;
}

try {
    $pdo->beginTransaction();

    // Lock the row through the check and consume operation. This makes a
    // duplicate submission deterministic: only the first request can consume
    // the current code.
    $stmt = $pdo->prepare(
        'SELECT customer_id, email_verified, otp_code, otp_expires_at,
                (otp_expires_at IS NOT NULL AND otp_expires_at > NOW()) AS otp_active
         FROM customers
         WHERE customer_id = ?
         LIMIT 1
         FOR UPDATE'
    );
    $stmt->execute([$customerId]);
    $customer = $stmt->fetch();

    if (!$customer) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => $invalidCodeMessage]);
        exit;
    }

    if ((int)$customer['email_verified'] === 1) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => 'This account is already verified.']);
        exit;
    }

    // NULL expiry is deliberately treated as expired. This protects rows
    // created before the lifecycle migration from being valid indefinitely.
    if ($customer['otp_code'] === null || (int)$customer['otp_active'] !== 1) {
        $clearStmt = $pdo->prepare(
            'UPDATE customers
             SET otp_code = NULL, otp_expires_at = NULL
             WHERE customer_id = ? AND email_verified = 0'
        );
        $clearStmt->execute([$customerId]);
        $pdo->commit();
        echo json_encode(['success' => false, 'error' => $expiredCodeMessage]);
        exit;
    }

    if (!hash_equals((string)$customer['otp_code'], $otpInput)) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => $invalidCodeMessage]);
        exit;
    }

    // Keep the expiry predicate in the write as a final guard in case this
    // endpoint is changed to use a less restrictive transaction later.
    $verifyStmt = $pdo->prepare(
        'UPDATE customers
         SET email_verified = 1,
             otp_code = NULL,
             otp_expires_at = NULL,
             otp_last_sent_at = NULL
         WHERE customer_id = ?
           AND email_verified = 0
           AND otp_code = ?
           AND otp_expires_at > NOW()'
    );
    $verifyStmt->execute([$customerId, $otpInput]);

    if ($verifyStmt->rowCount() !== 1) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => $expiredCodeMessage]);
        exit;
    }

    $pdo->commit();
    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('OTP verification database error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Unable to verify the code right now.']);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('OTP verification failed: ' . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Unable to verify the code right now.']);
}
