<?php
require_once __DIR__ . '/../../config/database.php';
header('Content-Type: application/json');

// TODO: require admin session once Step 9 (Account Management/admin login) is built

$salonName = trim($_POST['salon_name'] ?? '');
$description = trim($_POST['description'] ?? '');
$missionStatement = trim($_POST['mission_statement'] ?? '');

if (!$salonName || !$description || !$missionStatement) {
    echo json_encode(['success' => false, 'error' => 'All fields (Salon Name, Description, Mission Statement) are required.']);
    exit;
}

try {
    $checkStmt = $pdo->query("SELECT id FROM about_content ORDER BY id ASC LIMIT 1");
    $existingId = $checkStmt->fetchColumn();

    if ($existingId) {
        $stmt = $pdo->prepare("
            UPDATE about_content
            SET salon_name = ?, description = ?, mission_statement = ?
            WHERE id = ?
        ");
        $stmt->execute([$salonName, $description, $missionStatement, $existingId]);
    } else {
        $stmt = $pdo->prepare("
            INSERT INTO about_content (salon_name, description, mission_statement)
            VALUES (?, ?, ?)
        ");
        $stmt->execute([$salonName, $description, $missionStatement]);
    }

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error updating About content']);
}
