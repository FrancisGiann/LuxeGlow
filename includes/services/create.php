<?php
require_once __DIR__ . '/../../config/database.php';
header('Content-Type: application/json');

// TODO: require admin session once Step 9 (Account Management/admin login) is built

$name = trim($_POST['name'] ?? '');
$category = trim($_POST['category'] ?? '');
$description = trim($_POST['description'] ?? '');
$price = (float)($_POST['price'] ?? 0);
$duration_minutes = (int)($_POST['duration_minutes'] ?? 0);

if (!$name || !$category || $price <= 0 || $duration_minutes <= 0) {
    echo json_encode(['success' => false, 'error' => 'Missing required fields']);
    exit;
}

$service_id = trim($_POST['service_id'] ?? '');
if (!$service_id) {
    $service_id = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $name), '-'));
}

$image_path = null;
if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
    $ext = pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION);
    $filename = $service_id . '-' . time() . '.' . $ext;
    $targetPath = __DIR__ . '/../../uploads/services/' . $filename;
    
    if (move_uploaded_file($_FILES['image']['tmp_name'], $targetPath)) {
        $image_path = 'uploads/services/' . $filename;
    }
}

try {
    $stmt = $pdo->prepare("INSERT INTO services (service_id, name, category, description, price, duration_minutes, image_path) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$service_id, $name, $category, $description, $price, $duration_minutes, $image_path]);
    echo json_encode(['success' => true, 'service_id' => $service_id]);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'Database error. ID might not be unique.']);
}
