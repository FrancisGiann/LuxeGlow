<?php
// includes/auth/complete_password_reset.php
session_start();
require_once __DIR__ . '/../../config/database.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

$invalidCodeMessage = 'The reset code is invalid or expired.';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Invalid request method.']);
    exit;
}

$email = strtolower(trim((string)($_POST['email'] ?? '')));
$code = trim((string)($_POST['code'] ?? ''));
$password = (string)($_POST['password'] ?? '');
$confirmPassword = (string)($_POST['confirm_password'] ?? '');

if ($email === '' || strlen($email) > 255 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'error' => 'Please enter a valid email address.']);
    exit;
}

if (!preg_match('/^[0-9]{6}$/D', $code)) {
    echo json_encode(['success' => false, 'error' => $invalidCodeMessage]);
    exit;
}

if (strlen($password) < 8) {
    echo json_encode(['success' => false, 'error' => 'Password must be at least 8 characters.']);
    exit;
}

if ($password !== $confirmPassword) {
    echo json_encode(['success' => false, 'error' => 'Passwords do not match.']);
    exit;
}

try {
    $pdo->beginTransaction();

    // Lock both rows for the complete read/verify/write operation. This
    // prevents two requests from consuming the same reset token concurrently.
    $customerStmt = $pdo->prepare('SELECT customer_id FROM customers WHERE email = ? FOR UPDATE');
    $customerStmt->execute([$email]);
    $customer = $customerStmt->fetch();

    if (!$customer) {
        $pdo->commit();
        echo json_encode(['success' => false, 'error' => $invalidCodeMessage]);
        exit;
    }

    $tokenStmt = $pdo->prepare(
        'SELECT reset_id, token_hash, attempts, used_at,
                (expires_at > NOW()) AS is_unexpired
         FROM password_reset_tokens
         WHERE customer_id = ?
         LIMIT 1 FOR UPDATE'
    );
    $tokenStmt->execute([$customer['customer_id']]);
    $token = $tokenStmt->fetch();

    if (!$token || $token['used_at'] !== null || (int)$token['is_unexpired'] !== 1 || (int)$token['attempts'] >= 5) {
        $pdo->commit();
        echo json_encode(['success' => false, 'error' => $invalidCodeMessage]);
        exit;
    }

    if (!password_verify($code, (string)$token['token_hash'])) {
        $attemptStmt = $pdo->prepare('UPDATE password_reset_tokens SET attempts = attempts + 1 WHERE reset_id = ?');
        $attemptStmt->execute([$token['reset_id']]);
        $pdo->commit();
        echo json_encode(['success' => false, 'error' => $invalidCodeMessage]);
        exit;
    }

    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    if ($passwordHash === false) {
        throw new RuntimeException('Password hashing failed.');
    }

    $passwordStmt = $pdo->prepare('UPDATE customers SET password_hash = ? WHERE customer_id = ?');
    $passwordStmt->execute([$passwordHash, $customer['customer_id']]);

    // Retain a small audit trail while making the token unusable immediately.
    $usedStmt = $pdo->prepare('UPDATE password_reset_tokens SET used_at = NOW() WHERE reset_id = ? AND used_at IS NULL');
    $usedStmt->execute([$token['reset_id']]);
    if ($usedStmt->rowCount() !== 1) {
        throw new RuntimeException('Reset token could not be invalidated.');
    }

    $pdo->commit();
    echo json_encode(['success' => true, 'message' => 'Your password has been reset.']);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Password reset completion failed: ' . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Unable to reset the password right now.']);
}
