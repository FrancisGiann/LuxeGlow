<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../admin-auth/require_admin.php';
header('Content-Type: application/json');

$question = trim($_POST['question'] ?? 'New question');
$answer = trim($_POST['answer'] ?? 'Add your answer here.');

try {
    $maxStmt = $pdo->query("SELECT MAX(display_order) FROM faqs");
    $maxOrder = (int)$maxStmt->fetchColumn();
    $nextOrder = $maxOrder + 1;

    $stmt = $pdo->prepare("
        INSERT INTO faqs (question, answer, display_order)
        VALUES (?, ?, ?)
    ");
    $stmt->execute([$question, $answer, $nextOrder]);
    $faqId = (int)$pdo->lastInsertId();

    echo json_encode(['success' => true, 'id' => $faqId]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error creating FAQ']);
}
