<?php
// includes/email/send_notification.php

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/../../vendor/autoload.php';

/**
 * Sends an email notification for an appointment life-cycle event.
 * 
 * @param PDO $pdo
 * @param string $appointmentId
 * @param string $type ('pending'|'confirmed'|'reminder'|'cancelled')
 * @return bool True if sent & recorded (or already sent), false if failed.
 */
function sendAppointmentEmail(PDO $pdo, string $appointmentId, string $type): bool
{
    $allowedTypes = ['pending', 'confirmed', 'reminder', 'cancelled'];
    if (!in_array($type, $allowedTypes, true)) {
        error_log("sendAppointmentEmail: Invalid type '$type'");
        return false;
    }

    try {
        // 1. Check if email notification was ALREADY sent for this appointment + type
        $chkStmt = $pdo->prepare("
            SELECT id FROM appointment_notifications 
            WHERE appointment_id = :app_id AND type = :type
        ");
        $chkStmt->execute([
            ':app_id' => $appointmentId,
            ':type'   => $type
        ]);
        if ($chkStmt->fetch()) {
            // Already sent previously
            return true;
        }

        // 2. Fetch appointment, customer, and service details
        $appStmt = $pdo->prepare("
            SELECT 
                a.appointment_id,
                a.appointment_date,
                a.appointment_time,
                a.total_price,
                a.status,
                c.customer_id,
                c.first_name,
                c.last_name,
                c.email,
                GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ', ') AS service_names
            FROM appointments a
            JOIN customers c ON a.customer_id = c.customer_id
            LEFT JOIN appointment_services aps ON a.appointment_id = aps.appointment_id
            LEFT JOIN services s ON aps.service_id = s.service_id
            WHERE a.appointment_id = :app_id
            GROUP BY a.appointment_id
        ");
        $appStmt->execute([':app_id' => $appointmentId]);
        $data = $appStmt->fetch(PDO::FETCH_ASSOC);

        if (!$data || empty($data['email'])) {
            error_log("sendAppointmentEmail: Appointment $appointmentId or customer email not found.");
            return false;
        }

        $customerName  = trim($data['first_name'] . ' ' . ($data['last_name'] ?? ''));
        $customerEmail = $data['email'];
        $dateFormatted = date('F j, Y', strtotime($data['appointment_date']));
        $timeFormatted = date('g:i A', strtotime($data['appointment_time']));
        $services      = $data['service_names'] ?: 'Beauty Service';
        $priceFormatted= '₱' . number_format((float)$data['total_price'], 2);

        // 3. Build Subject & Email Content based on notification type
        $subject = '';
        $headline = '';
        $bodyContent = '';

        switch ($type) {
            case 'pending':
                $subject  = "Your booking is pending — [{$appointmentId}]";
                $headline = "Booking Received!";
                $bodyContent = "
                    <p>Hello <strong>{$customerName}</strong>,</p>
                    <p>Thank you for booking with Astrid Nails & Beauty Bar. Your appointment request has been successfully received and is currently <strong>Pending approval</strong>.</p>
                    <div style='background:#f9fafb; padding:15px; border-radius:8px; margin:20px 0;'>
                        <p style='margin:4px 0;'><strong>Reference ID:</strong> {$appointmentId}</p>
                        <p style='margin:4px 0;'><strong>Date:</strong> {$dateFormatted}</p>
                        <p style='margin:4px 0;'><strong>Time:</strong> {$timeFormatted}</p>
                        <p style='margin:4px 0;'><strong>Services:</strong> {$services}</p>
                        <p style='margin:4px 0;'><strong>Total Price:</strong> {$priceFormatted}</p>
                    </div>
                    <p>We will notify you as soon as your booking is confirmed by our salon team.</p>
                ";
                break;

            case 'confirmed':
                $subject  = "Your booking has been confirmed — [{$appointmentId}]";
                $headline = "Booking Confirmed!";
                $bodyContent = "
                    <p>Great news, <strong>{$customerName}</strong>!</p>
                    <p>Your appointment at Astrid Nails & Beauty Bar has been <strong>Confirmed</strong>.</p>
                    <div style='background:#f9fafb; padding:15px; border-radius:8px; margin:20px 0;'>
                        <p style='margin:4px 0;'><strong>Reference ID:</strong> {$appointmentId}</p>
                        <p style='margin:4px 0;'><strong>Date:</strong> {$dateFormatted}</p>
                        <p style='margin:4px 0;'><strong>Time:</strong> {$timeFormatted}</p>
                        <p style='margin:4px 0;'><strong>Services:</strong> {$services}</p>
                    </div>
                    <p>We look forward to welcoming you! Please arrive on time for your scheduled visit.</p>
                ";
                break;

            case 'reminder':
                $subject  = "Your appointment is starting now — [{$appointmentId}]";
                $headline = "Appointment Reminder";
                $bodyContent = "
                    <p>Hello <strong>{$customerName}</strong>,</p>
                    <p>This is a quick reminder that your scheduled appointment is starting now.</p>
                    <div style='background:#fff7ed; border-left:4px solid #f97316; padding:15px; border-radius:8px; margin:20px 0;'>
                        <p style='margin:4px 0;'><strong>Reference ID:</strong> {$appointmentId}</p>
                        <p style='margin:4px 0;'><strong>Scheduled Date & Time:</strong> {$dateFormatted} at {$timeFormatted}</p>
                        <p style='margin:4px 0;'><strong>Services:</strong> {$services}</p>
                    </div>
                    <p><strong>Important:</strong> If you are running late, please arrive within 15 minutes. Appointments not claimed within 15 minutes of the scheduled time may be automatically cancelled to accommodate other guests.</p>
                ";
                break;

            case 'cancelled':
                $subject  = "Your appointment has been cancelled — [{$appointmentId}]";
                $headline = "Appointment Cancelled";
                $bodyContent = "
                    <p>Hello <strong>{$customerName}</strong>,</p>
                    <p>Your appointment request (Reference ID: <strong>{$appointmentId}</strong>) has been <strong>Cancelled</strong>.</p>
                    <div style='background:#fef2f2; border-left:4px solid #ef4444; padding:15px; border-radius:8px; margin:20px 0;'>
                        <p style='margin:4px 0;'><strong>Reference ID:</strong> {$appointmentId}</p>
                        <p style='margin:4px 0;'><strong>Date:</strong> {$dateFormatted}</p>
                        <p style='margin:4px 0;'><strong>Services:</strong> {$services}</p>
                    </div>
                    <p>If you'd like to reschedule, feel free to book a new appointment on our website anytime.</p>
                ";
                break;
        }

        // HTML Layout Wrapper
        $fullHtml = "
            <!DOCTYPE html>
            <html>
            <head><meta charset='UTF-8'></head>
            <body style='font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;'>
                <div style='background: #6b21a8; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;'>
                    <h1 style='color: #ffffff; margin: 0; font-size: 20px;'>Astrid Nails & Beauty Bar</h1>
                </div>
                <div style='border: 1px solid #e5e7eb; border-top: none; padding: 25px; border-radius: 0 0 10px 10px;'>
                    <h2 style='color: #1f2937; margin-top: 0;'>{$headline}</h2>
                    {$bodyContent}
                    <hr style='border: none; border-top: 1px solid #eee; margin: 25px 0;' />
                    <p style='font-size: 12px; color: #9ca3af; text-align: center; margin: 0;'>
                        &copy; " . date('Y') . " Astrid Nails & Beauty Bar. All rights reserved.
                    </p>
                </div>
            </body>
            </html>
        ";

        // 4. Load SMTP Configuration
        $mailConfig = require __DIR__ . '/../../config/mail.php';

        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host       = $mailConfig['host'];
        $mail->SMTPAuth   = true;
        $mail->Username   = $mailConfig['username'];
        $mail->Password   = $mailConfig['password'];
        $mail->SMTPSecure = $mailConfig['encryption'] === 'ssl' ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = $mailConfig['port'];

        $mail->setFrom($mailConfig['from_address'], $mailConfig['from_name']);
        $mail->addAddress($customerEmail, $customerName);

        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $fullHtml;

        $mail->send();

        // 5. Insert into appointment_notifications ONLY AFTER successful send
        $insStmt = $pdo->prepare("
            INSERT INTO appointment_notifications (appointment_id, type)
            VALUES (:app_id, :type)
            ON DUPLICATE KEY UPDATE sent_at = CURRENT_TIMESTAMP
        ");
        $insStmt->execute([
            ':app_id' => $appointmentId,
            ':type'   => $type
        ]);

        return true;

    } catch (Exception $e) {
        error_log("sendAppointmentEmail failed for [{$appointmentId} / {$type}]: " . $e->getMessage());
        return false;
    } catch (PDOException $e) {
        error_log("sendAppointmentEmail DB error for [{$appointmentId} / {$type}]: " . $e->getMessage());
        return false;
    }
}
