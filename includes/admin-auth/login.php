<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
require_once __DIR__ . '/../../config/database.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Invalid request method.']);
    exit;
}

$username = trim($_POST['username'] ?? '');
$password = $_POST['password'] ?? '';

if (!$username || !$password) {
    echo json_encode(['success' => false, 'error' => 'Username and password are required.']);
    exit;
}

try {
    $stmt = $pdo->prepare("
        SELECT account_id, name, username, password_hash, status, role
        FROM staff_accounts
        WHERE username = ?
    ");
    $stmt->execute([$username]);
    $account = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$account || !password_verify($password, $account['password_hash'])) {
        echo json_encode(['success' => false, 'error' => 'Invalid username or password.']);
        exit;
    }

    if ($account['status'] !== 'Active') {
        echo json_encode(['success' => false, 'error' => 'This account has been deactivated. Contact a Super Admin.']);
        exit;
    }

    // Set distinct admin session variables
    $_SESSION['admin_id'] = (int)$account['account_id'];
    $_SESSION['admin_name'] = $account['name'];
    $_SESSION['admin_username'] = $account['username'];
    $_SESSION['admin_role'] = $account['role'];

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error during admin login']);
}
