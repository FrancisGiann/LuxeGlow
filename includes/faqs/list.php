<?php
require_once __DIR__ . '/../../config/database.php';
header('Content-Type: application/json');

try {
    $stmt = $pdo->query("
        SELECT 
            faq_id AS id,
            question AS q,
            answer AS a,
            display_order
        FROM faqs
        ORDER BY display_order ASC, faq_id ASC
    ");
    $faqs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($faqs);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error loading FAQs']);
}
