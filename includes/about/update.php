<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../admin-auth/require_admin.php';
header('Content-Type: application/json');

$salonName = trim($_POST['salon_name'] ?? '');
$description = trim($_POST['description'] ?? '');
$missionStatement = trim($_POST['mission_statement'] ?? '');

// Business information — optional, saved as NULL when left blank
$phone         = trim($_POST['phone'] ?? '');
$email         = trim($_POST['email'] ?? '');
$address       = trim($_POST['address'] ?? '');
$businessHours = trim($_POST['business_hours'] ?? '');
$salonPolicies = trim($_POST['salon_policies'] ?? '');

if (!$salonName || !$description || !$missionStatement) {
    echo json_encode(['success' => false, 'error' => 'Salon Name, Description and Mission Statement are required.']);
    exit;
}

try {
    $checkStmt = $pdo->query("SELECT id FROM about_content ORDER BY id ASC LIMIT 1");
    $existingId = $checkStmt->fetchColumn();

    if ($existingId) {
        $stmt = $pdo->prepare("
            UPDATE about_content
            SET salon_name = ?, description = ?, mission_statement = ?,
                phone = ?, email = ?, address = ?, business_hours = ?, salon_policies = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $salonName, $description, $missionStatement,
            $phone ?: null, $email ?: null, $address ?: null,
            $businessHours ?: null, $salonPolicies ?: null,
            $existingId
        ]);
    } else {
        $stmt = $pdo->prepare("
            INSERT INTO about_content (salon_name, description, mission_statement, phone, email, address, business_hours, salon_policies)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $salonName, $description, $missionStatement,
            $phone ?: null, $email ?: null, $address ?: null,
            $businessHours ?: null, $salonPolicies ?: null
        ]);
    }

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error updating About content']);
}
