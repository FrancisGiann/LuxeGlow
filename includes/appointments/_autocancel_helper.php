<?php
// includes/appointments/_autocancel_helper.php

/**
 * Sweeps appointments that are > 15 minutes past their scheduled date & time
 * and automatically cancels them if they are still 'Pending' or 'Confirmed'.
 * 
 * @param PDO $pdo
 * @return array Array of newly auto-cancelled appointments [['appointment_id' => string, 'customer_id' => int]]
 */
function autoCancelLateAppointments(PDO $pdo): array
{
    try {
        // 1. Identify appointments that are > 15 minutes past scheduled time
        $findStmt = $pdo->query("
            SELECT appointment_id, customer_id 
            FROM appointments
            WHERE status IN ('Pending', 'Confirmed')
              AND TIMESTAMP(appointment_date, appointment_time) + INTERVAL 15 MINUTE < NOW()
        ");
        $toCancel = $findStmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($toCancel)) {
            return [];
        }

        // 2. Perform UPDATE query
        $appIds = array_column($toCancel, 'appointment_id');
        $inClause = implode(',', array_fill(0, count($appIds), '?'));
        
        $updStmt = $pdo->prepare("
            UPDATE appointments
            SET status = 'Cancelled'
            WHERE appointment_id IN ($inClause)
        ");
        $updStmt->execute($appIds);

        return $toCancel;

    } catch (PDOException $e) {
        error_log("autoCancelLateAppointments failed: " . $e->getMessage());
        return [];
    }
}
