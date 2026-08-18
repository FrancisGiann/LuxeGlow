<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../admin-auth/require_super_admin.php';
header('Content-Type: application/json');

$name = trim($_POST['name'] ?? '');
$position = trim($_POST['position'] ?? '');
$contactNumber = trim($_POST['contact_number'] ?? '');
$email = trim($_POST['email'] ?? '');
$address = trim($_POST['address'] ?? '');
$username = trim($_POST['username'] ?? '');
$password = $_POST['password'] ?? '';
$role = trim($_POST['role'] ?? 'Staff');

if (!$name || !$position || !$email || !$username || !$password) {
    echo json_encode(['success' => false, 'error' => 'Name, Position, Email, Username, and Password are required.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'error' => 'Invalid email address.']);
    exit;
}

if (strlen($password) < 8) {
    echo json_encode(['success' => false, 'error' => 'Password must be at least 8 characters long.']);
    exit;
}

if (!in_array($role, ['Super Admin', 'Staff'])) {
    $role = 'Staff';
}

try {
    // Check email uniqueness
    $checkStmt = $pdo->prepare("SELECT account_id FROM staff_accounts WHERE email = ?");
    $checkStmt->execute([$email]);
    if ($checkStmt->fetch()) {
        echo json_encode(['success' => false, 'error' => 'An account with this email already exists.']);
        exit;
    }

    // Check username uniqueness
    $checkStmt = $pdo->prepare("SELECT account_id FROM staff_accounts WHERE username = ?");
    $checkStmt->execute([$username]);
    if ($checkStmt->fetch()) {
        echo json_encode(['success' => false, 'error' => 'An account with this username already exists.']);
        exit;
    }

    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    $stmt = $pdo->prepare("
        INSERT INTO staff_accounts (name, position, contact_number, email, address, username, password_hash, status, role)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?)
    ");
    $stmt->execute([$name, $position, $contactNumber, $email, $address, $username, $passwordHash, $role]);

    echo json_encode(['success' => true, 'account_id' => (int)$pdo->lastInsertId()]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error creating staff account']);
}
