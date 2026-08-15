<?php
require_once __DIR__ . '/../../config/database.php';
header('Content-Type: application/json');

$stmt = $pdo->query("SELECT * FROM services ORDER BY name ASC");
$dbServices = $stmt->fetchAll();

$services = array_map(function($row) {
    $mins = (int)$row['duration_minutes'];
    $hours = floor($mins / 60);
    $remMins = $mins % 60;
    
    $durationStr = '';
    if ($hours > 0) $durationStr .= $hours . ($hours > 1 ? " hours " : " hour ");
    if ($remMins > 0) $durationStr .= $remMins . " minutes";
    $durationStr = trim($durationStr);

    return [
        'id'          => $row['service_id'],
        'name'        => $row['name'],
        'category'    => $row['category'],
        'description' => $row['description'],
        'price'       => (float)$row['price'],
        'duration'    => $durationStr,
        'minutes'     => $mins,
        'rating'      => (float)$row['rating'],
        'image_path'  => $row['image_path']
    ];
}, $dbServices);

echo json_encode($services);
