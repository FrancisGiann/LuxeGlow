<?php
// includes/notifications/create.php

/**
 * Creates an in-website notification for a customer.
 * 
 * @param PDO $pdo
 * @param int $customerId
 * @param string $appointmentId
 * @param string $type ('pending'|'confirmed'|'reminder'|'cancelled')
 * @param string $title
 * @param string $message
 * @return bool
 */
function createCustomerNotification(PDO $pdo, int $customerId, string $appointmentId, string $type, string $title, string $message): bool
{
    $allowedTypes = ['pending', 'confirmed', 'reminder', 'cancelled'];
    if (!in_array($type, $allowedTypes, true)) {
        return false;
    }

    try {
        $stmt = $pdo->prepare("
            INSERT INTO user_notifications (customer_id, appointment_id, type, title, message)
            VALUES (:customer_id, :appointment_id, :type, :title, :message)
        ");
        return $stmt->execute([
            ':customer_id'    => $customerId,
            ':appointment_id' => $appointmentId,
            ':type'           => $type,
            ':title'          => $title,
            ':message'        => $message
        ]);
    } catch (PDOException $e) {
        error_log("Failed to create website notification: " . $e->getMessage());
        return false;
    }
}
