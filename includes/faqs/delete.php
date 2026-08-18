<?php
require_once __DIR__ . '/../../config/database.php';
header('Content-Type: application/json');

// TODO: require admin session once Step 9 (Account Management/admin login) is built

$faqId = (int)($_POST['faq_id'] ?? 0);

if ($faqId <= 0) {
    echo json_encode(['success' => false, 'error' => 'Invalid FAQ ID']);
    exit;
}

try {
    $stmt = $pdo->prepare("DELETE FROM faqs WHERE faq_id = ?");
    $stmt->execute([$faqId]);

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error deleting FAQ']);
}
