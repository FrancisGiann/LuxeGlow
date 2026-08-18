<?php
require_once __DIR__ . '/../../config/database.php';
header('Content-Type: application/json');

// TODO: require admin session once Step 9 (Account Management/admin login) is built

$faqId = (int)($_POST['faq_id'] ?? 0);
$question = trim($_POST['question'] ?? '');
$answer = trim($_POST['answer'] ?? '');

if ($faqId <= 0 || !$question || !$answer) {
    echo json_encode(['success' => false, 'error' => 'Question and answer are required.']);
    exit;
}

try {
    $stmt = $pdo->prepare("
        UPDATE faqs
        SET question = ?, answer = ?
        WHERE faq_id = ?
    ");
    $stmt->execute([$question, $answer, $faqId]);

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error updating FAQ']);
}
