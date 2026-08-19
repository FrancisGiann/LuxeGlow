<?php
require_once __DIR__ . '/../../config/database.php';
header('Content-Type: application/json');

$limit = isset($_GET['limit']) ? max(1, min(100, (int)$_GET['limit'])) : 20;

try {
    // 1. Calculate overall aggregate statistics (total count & average rating across ALL reviews)
    $statsStmt = $pdo->query("
        SELECT 
            COUNT(*) AS total_reviews,
            COALESCE(ROUND(AVG(rating), 1), 0) AS average_rating
        FROM reviews
    ");
    $statsRow = $statsStmt->fetch(PDO::FETCH_ASSOC);

    $totalReviews  = (int)($statsRow['total_reviews'] ?? 0);
    $averageRating = (float)($statsRow['average_rating'] ?? 0);

    // 2. Query recent public reviews joined with customer first name + last initial and services
    $sql = "
        SELECT 
            r.review_id,
            r.rating,
            r.review_text,
            r.created_at,
            c.first_name,
            c.last_name,
            GROUP_CONCAT(DISTINCT s.name ORDER BY s.name SEPARATOR ', ') AS service_names
        FROM reviews r
        JOIN customers c ON r.customer_id = c.customer_id
        JOIN appointments a ON r.appointment_id = a.appointment_id
        LEFT JOIN appointment_services aps ON a.appointment_id = aps.appointment_id
        LEFT JOIN services s ON aps.service_id = s.service_id
        GROUP BY r.review_id, r.rating, r.review_text, r.created_at, c.first_name, c.last_name
        ORDER BY r.created_at DESC, r.review_id DESC
        LIMIT :limit
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $rawReviews = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Privacy formatting: Customer First Name + Last Initial (e.g. "Maria S.")
    $formattedReviews = array_map(function ($row) {
        $firstName = trim($row['first_name'] ?? '');
        $lastName  = trim($row['last_name'] ?? '');

        if ($lastName !== '') {
            $displayName = $firstName . ' ' . mb_substr($lastName, 0, 1) . '.';
        } else {
            $displayName = $firstName ?: 'Valued Customer';
        }

        return [
            'review_id'     => (int)$row['review_id'],
            'rating'        => (int)$row['rating'],
            'review_text'   => $row['review_text'] ?: '',
            'created_at'    => $row['created_at'],
            'customer_name' => $displayName,
            'service_names' => $row['service_names'] ?: 'Beauty Service'
        ];
    }, $rawReviews);

    echo json_encode([
        'success' => true,
        'stats'   => [
            'total_reviews'  => $totalReviews,
            'average_rating' => $averageRating
        ],
        'reviews' => $formattedReviews
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error while fetching reviews']);
}
