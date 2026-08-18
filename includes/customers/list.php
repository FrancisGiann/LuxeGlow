<?php
require_once __DIR__ . '/../../config/database.php';
header('Content-Type: application/json');

// TODO: require admin session once Step 9 (Account Management/admin login) is built

try {
    $sql = "
        SELECT 
            c.customer_id AS id,
            CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) AS name,
            c.first_name,
            c.last_name,
            c.email,
            c.phone,
            COUNT(CASE WHEN a.status = 'Completed' THEN 1 END) AS visits,
            COALESCE(SUM(CASE WHEN a.status = 'Completed' THEN a.total_price ELSE 0 END), 0) AS spent,
            MAX(CASE WHEN a.status = 'Completed' THEN a.appointment_date END) AS last_visit_raw
        FROM customers c
        LEFT JOIN appointments a ON c.customer_id = a.customer_id
        GROUP BY c.customer_id
        ORDER BY 
            CASE WHEN MAX(CASE WHEN a.status = 'Completed' THEN a.appointment_date END) IS NULL THEN 1 ELSE 0 END,
            MAX(CASE WHEN a.status = 'Completed' THEN a.appointment_date END) DESC,
            c.first_name ASC,
            c.last_name ASC
    ";

    $stmt = $pdo->query($sql);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $formatted = array_map(function ($row) {
        $lastVisitFormatted = 'No visits yet';
        if (!empty($row['last_visit_raw'])) {
            $ts = strtotime($row['last_visit_raw']);
            $lastVisitFormatted = date('F j, Y', $ts);
        }

        return [
            'id'         => (int)$row['id'],
            'name'       => trim($row['name']) ?: 'Unnamed Customer',
            'first_name' => $row['first_name'],
            'last_name'  => $row['last_name'],
            'email'      => $row['email'],
            'phone'      => $row['phone'],
            'visits'     => (int)$row['visits'],
            'spent'      => (float)$row['spent'],
            'lastVisit'  => $lastVisitFormatted
        ];
    }, $rows);

    echo json_encode($formatted);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error loading customers']);
}
