<?php
// includes/cron/appointment_notifier.php

// 1. Load dependencies
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../notifications/create.php';
require_once __DIR__ . '/../email/send_notification.php';
require_once __DIR__ . '/../appointments/_autocancel_helper.php';

/**
 * Runs the time-based appointment notifier CLI worker.
 * 
 * @param PDO $pdo
 * @param bool $isCli If true, outputs plain text to CLI; if false, returns array summary.
 * @return array Summary of execution results
 */
function runAppointmentNotifier(PDO $pdo, bool $isCli = true): array
{
    $remindersSent = 0;
    $autoCancelled = 0;
    $cancelsSent   = 0;
    $errorsCount   = 0;

    if ($isCli) {
        echo "Appointment notifier started.\n";
    }

    try {
        // ==========================================
        // TASK A — Send Reminder Notifications
        // ==========================================
        // Find Confirmed appointments where scheduled time has arrived and is within the 15-min window,
        // and a 'reminder' notification has NOT already been sent.
        $remStmt = $pdo->prepare("
            SELECT a.appointment_id, a.customer_id
            FROM appointments a
            LEFT JOIN appointment_notifications n 
                ON a.appointment_id = n.appointment_id AND n.type = 'reminder'
            WHERE a.status = 'Confirmed'
              AND TIMESTAMP(a.appointment_date, a.appointment_time) <= NOW()
              AND TIMESTAMP(a.appointment_date, a.appointment_time) + INTERVAL 15 MINUTE >= NOW()
              AND n.id IS NULL
        ");
        $remStmt->execute();
        $remindersToProcess = $remStmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($remindersToProcess as $rem) {
            $appId  = $rem['appointment_id'];
            $custId = (int)$rem['customer_id'];

            // 1. Create website Reminder notification
            createCustomerNotification(
                $pdo,
                $custId,
                $appId,
                'reminder',
                'Appointment Starting Now',
                "Your scheduled appointment (#{$appId}) is starting now. Please arrive within 15 minutes."
            );

            // 2. Send Reminder email (handles appointment_notifications deduplication insert inside)
            $sent = sendAppointmentEmail($pdo, $appId, 'reminder');
            if ($sent) {
                $remindersSent++;
            } else {
                $errorsCount++;
            }
        }

        // ==========================================
        // TASK B — Automatic Cancellation Sweep
        // ==========================================
        // Run shared 15-minute auto-cancel logic
        $newlyCancelled = autoCancelLateAppointments($pdo);
        $autoCancelled  = count($newlyCancelled);

        foreach ($newlyCancelled as $canc) {
            $appId  = $canc['appointment_id'];
            $custId = (int)$canc['customer_id'];

            // 1. Create website Cancelled notification
            createCustomerNotification(
                $pdo,
                $custId,
                $appId,
                'cancelled',
                'Appointment Cancelled',
                "Your appointment (#{$appId}) has been cancelled as it was not claimed within 15 minutes."
            );

            // 2. Send Cancelled email
            $sent = sendAppointmentEmail($pdo, $appId, 'cancelled');
            if ($sent) {
                $cancelsSent++;
            } else {
                $errorsCount++;
            }
        }

    } catch (Exception $e) {
        $errorsCount++;
        error_log("appointment_notifier error: " . $e->getMessage());
    }

    $summary = [
        'reminders_sent'          => $remindersSent,
        'auto_cancelled'          => $autoCancelled,
        'cancellations_sent'      => $cancelsSent,
        'errors'                  => $errorsCount,
        'timestamp'               => date('Y-m-d H:i:s')
    ];

    if ($isCli) {
        echo "Reminders sent: {$remindersSent}\n";
        echo "Auto-cancelled: {$autoCancelled}\n";
        echo "Cancellation notifications sent: {$cancelsSent}\n";
        echo "Errors: {$errorsCount}\n";
        echo "Appointment notifier finished.\n";
    }

    return $summary;
}

// Direct CLI Execution Guard
if (php_sapi_name() === 'cli') {
    $summary = runAppointmentNotifier($pdo, true);
    exit($summary['errors'] > 0 ? 1 : 0);
}
