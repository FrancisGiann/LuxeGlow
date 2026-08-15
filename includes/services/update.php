<?php
require_once __DIR__ . '/../../config/database.php';
header('Content-Type: application/json');

// TODO: require admin session once Step 9 (Account Management/admin login) is built

$service_id = trim($_POST['service_id'] ?? '');
$name = trim($_POST['name'] ?? '');
$category = trim($_POST['category'] ?? '');
$description = trim($_POST['description'] ?? '');
$price = (float)($_POST['price'] ?? 0);
$duration_minutes = (int)($_POST['duration_minutes'] ?? 0);

if (!$service_id) {
    echo json_encode(['success' => false, 'error' => 'Missing service_id']);
    exit;
}

$image_path = null;
$remove_image = isset($_POST['remove_image']) && $_POST['remove_image'] === '1';

if ($remove_image) {
    // Delete existing file if needed (optional cleanup)
    $stmt = $pdo->prepare("SELECT image_path FROM services WHERE service_id=?");
    $stmt->execute([$service_id]);
    $existing = $stmt->fetchColumn();
    if ($existing && file_exists(__DIR__ . '/../../' . $existing)) {
        unlink(__DIR__ . '/../../' . $existing);
    }
} elseif (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
    $ext = pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION);
    $filename = $service_id . '-' . time() . '.' . $ext;
    $targetPath = __DIR__ . '/../../uploads/services/' . $filename;
    
    if (move_uploaded_file($_FILES['image']['tmp_name'], $targetPath)) {
        $image_path = 'uploads/services/' . $filename;
    }
}

try {
    if ($remove_image) {
        $stmt = $pdo->prepare("UPDATE services SET name=?, category=?, description=?, price=?, duration_minutes=?, image_path=NULL WHERE service_id=?");
        $stmt->execute([$name, $category, $description, $price, $duration_minutes, $service_id]);
    } elseif ($image_path) {
        $stmt = $pdo->prepare("UPDATE services SET name=?, category=?, description=?, price=?, duration_minutes=?, image_path=? WHERE service_id=?");
        $stmt->execute([$name, $category, $description, $price, $duration_minutes, $image_path, $service_id]);
    } else {
        $stmt = $pdo->prepare("UPDATE services SET name=?, category=?, description=?, price=?, duration_minutes=? WHERE service_id=?");
        $stmt->execute([$name, $category, $description, $price, $duration_minutes, $service_id]);
    }
    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'Database error']);
}
