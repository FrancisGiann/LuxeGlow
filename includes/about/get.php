<?php
require_once __DIR__ . '/../../config/database.php';
header('Content-Type: application/json');

$defaultAbout = [
    'salon_name'        => 'Astrid Nails & Beauty Bar',
    'description'       => 'At Astrid Nails & Beauty Bar, we are committed to providing exceptional service and creating a relaxing atmosphere where you can unwind and be pampered.',
    'mission_statement' => 'To deliver premium beauty and wellness services that enhance our clients\' confidence and well-being through expert care, quality products, and personalized attention.',
    'phone'             => '',
    'email'             => '',
    'address'           => '',
    'business_hours'    => '',
    'salon_policies'    => ''
];

try {
    $stmt = $pdo->query("SELECT salon_name, description, mission_statement, phone, email, address, business_hours, salon_policies FROM about_content ORDER BY id ASC LIMIT 1");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row) {
        echo json_encode([
            'salon_name'        => $row['salon_name'] ?: $defaultAbout['salon_name'],
            'description'       => $row['description'] ?: $defaultAbout['description'],
            'mission_statement' => $row['mission_statement'] ?: $defaultAbout['mission_statement'],
            'phone'             => $row['phone'] ?: '',
            'email'             => $row['email'] ?: '',
            'address'           => $row['address'] ?: '',
            'business_hours'    => $row['business_hours'] ?: '',
            'salon_policies'    => $row['salon_policies'] ?: ''
        ]);
    } else {
        echo json_encode($defaultAbout);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error loading About content']);
}
