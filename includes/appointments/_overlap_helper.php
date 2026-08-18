<?php
/**
 * Shared helper to check if a requested appointment slot overlaps with existing Pending/Confirmed bookings or closing time.
 * Returns ['has_conflict' => true|false, 'reason' => string|null]
 */
function checkAppointmentOverlap($pdo, $date, $timeStr, $durationMinutes, $excludeAppointmentId = null) {
    $slotStartTimestamp = strtotime($timeStr);
    if (!$slotStartTimestamp) {
        return ['has_conflict' => true, 'reason' => 'Invalid time specified.'];
    }

    $slotStartSeconds = (date('H', $slotStartTimestamp) * 3600) + (date('i', $slotStartTimestamp) * 60);
    $slotEndSeconds = $slotStartSeconds + ($durationMinutes * 60);
    $closingTimeSeconds = 20 * 3600; // 8:00 PM closing time

    // 1. Closing time check
    if ($slotEndSeconds > $closingTimeSeconds) {
        return ['has_conflict' => true, 'reason' => 'Appointment duration exceeds 8:00 PM closing time.'];
    }

    // 2. Query existing Pending or Confirmed bookings on $date
    $sql = "
        SELECT 
            a.appointment_id,
            a.appointment_time AS start_time,
            ADDTIME(a.appointment_time, SEC_TO_TIME(SUM(s.duration_minutes) * 60)) AS end_time
        FROM appointments a
        JOIN appointment_services aps ON a.appointment_id = aps.appointment_id
        JOIN services s ON aps.service_id = s.service_id
        WHERE a.appointment_date = :date
          AND a.status IN ('Pending', 'Confirmed')
    ";
    
    $params = [':date' => $date];

    if ($excludeAppointmentId) {
        $sql .= " AND a.appointment_id != :exclude_id";
        $params[':exclude_id'] = $excludeAppointmentId;
    }

    $sql .= " GROUP BY a.appointment_id, a.appointment_time";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $existing = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 3. Evaluate overlap: startN < endA AND endN > startA
    foreach ($existing as $app) {
        $appStartParts = explode(':', $app['start_time']);
        $appStartSeconds = ($appStartParts[0] * 3600) + ($appStartParts[1] * 60);

        $appEndParts = explode(':', $app['end_time']);
        $appEndSeconds = ($appEndParts[0] * 3600) + ($appEndParts[1] * 60);

        if ($slotStartSeconds < $appEndSeconds && $slotEndSeconds > $appStartSeconds) {
            return ['has_conflict' => true, 'reason' => 'Time slot conflicts with an existing booking.'];
        }
    }

    return ['has_conflict' => false, 'reason' => null];
}
