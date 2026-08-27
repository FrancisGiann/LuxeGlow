<?php
/**
 * Read-only MariaDB export for the Supabase cutover.
 *
 * This intentionally does not copy password_hash values. Supabase Auth does
 * not support importing arbitrary legacy hashes through the public API; the
 * migration runbook provisions users with invite/recovery links instead.
 *
 * Usage: php scripts/export_mariadb.php --out=/secure/luxeglow-export
 */
declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

$out = null;
foreach (array_slice($argv, 1) as $arg) {
    if (str_starts_with($arg, '--out=')) $out = substr($arg, 6);
}
if (!$out) {
    fwrite(STDERR, "Missing --out=/path/to/export\n");
    exit(2);
}
if (!is_dir($out) && !mkdir($out, 0700, true) && !is_dir($out)) {
    throw new RuntimeException('Could not create export directory');
}

$host = $_ENV['LEGACY_DB_HOST'] ?? $_ENV['DB_HOST'] ?? '127.0.0.1';
$port = (int)($_ENV['LEGACY_DB_PORT'] ?? $_ENV['DB_PORT'] ?? 33066);
$name = $_ENV['LEGACY_DB_NAME'] ?? $_ENV['DB_NAME'] ?? 'astrid_nails';
$user = $_ENV['LEGACY_DB_USER'] ?? $_ENV['DB_USER'] ?? 'root';
$pass = (!empty($_ENV['LEGACY_DB_PASS'])) ? $_ENV['LEGACY_DB_PASS'] : ((!empty($_ENV['DB_PASS'])) ? $_ENV['DB_PASS'] : 'root');
$pdo = new PDO("mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4", $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

function csvFile(string $path, array $columns, iterable $rows): int
{
    $handle = fopen($path, 'wb');
    if (!$handle) throw new RuntimeException("Could not open {$path}");
    fputcsv($handle, $columns);
    $count = 0;
    foreach ($rows as $row) {
        $values = [];
        foreach ($columns as $column) $values[] = $row[$column] ?? null;
        fputcsv($handle, $values);
        $count++;
    }
    fclose($handle);
    chmod($path, 0600);
    return $count;
}

$queries = [
    'profiles.csv' => [
        ['kind', 'legacy_id', 'email', 'first_name', 'last_name', 'phone', 'username', 'legacy_status', 'legacy_role'],
        "SELECT 'customer' kind, customer_id legacy_id, email, first_name, last_name, phone, NULL username, IF(email_verified = 1, 'verified', 'unverified') legacy_status, NULL legacy_role FROM customers ORDER BY customer_id",
    ],
    'staff.csv' => [
        ['kind', 'legacy_id', 'email', 'first_name', 'last_name', 'phone', 'username', 'legacy_status', 'legacy_role'],
        "SELECT 'staff' kind, account_id legacy_id, email, SUBSTRING_INDEX(name, ' ', 1) first_name, SUBSTRING(name, LENGTH(SUBSTRING_INDEX(name, ' ', 1)) + 2) last_name, contact_number phone, username, status legacy_status, role legacy_role FROM staff_accounts ORDER BY account_id",
    ],
    'services.csv' => [
        ['id', 'name', 'category', 'description', 'price', 'duration_minutes', 'rating', 'image_path'],
        'SELECT service_id id, name, category, description, price, duration_minutes, rating, image_path FROM services ORDER BY service_id',
    ],
    'about_content.csv' => [
        ['legacy_id', 'business_name', 'description', 'mission_statement', 'phone', 'email', 'address', 'business_hours', 'salon_policies'],
        'SELECT id legacy_id, salon_name business_name, description, mission_statement, phone, email, address, business_hours, salon_policies FROM about_content ORDER BY id',
    ],
    'faqs.csv' => [
        ['legacy_id', 'question', 'answer', 'display_order'],
        'SELECT faq_id legacy_id, question, answer, display_order FROM faqs ORDER BY display_order, faq_id',
    ],
    'appointments.csv' => [
        ['legacy_id', 'legacy_customer_id', 'local_date', 'local_time', 'total_price', 'status', 'created_at'],
        'SELECT appointment_id legacy_id, customer_id legacy_customer_id, appointment_date local_date, appointment_time local_time, total_price, status, created_at FROM appointments ORDER BY appointment_date, appointment_time, appointment_id',
    ],
    'appointment_services.csv' => [
        ['legacy_appointment_id', 'service_id'],
        'SELECT appointment_id legacy_appointment_id, service_id FROM appointment_services ORDER BY appointment_id, service_id',
    ],
    'user_notifications.csv' => [
        ['legacy_id', 'legacy_customer_id', 'legacy_appointment_id', 'type', 'title', 'message', 'is_read', 'created_at'],
        'SELECT id legacy_id, customer_id legacy_customer_id, appointment_id legacy_appointment_id, type, title, message, is_read, created_at FROM user_notifications ORDER BY id',
    ],
    'appointment_notifications.csv' => [
        ['legacy_id', 'legacy_appointment_id', 'type', 'sent_at'],
        'SELECT id legacy_id, appointment_id legacy_appointment_id, type, sent_at FROM appointment_notifications ORDER BY id',
    ],
    'reviews.csv' => [
        ['legacy_id', 'legacy_customer_id', 'legacy_appointment_id', 'rating', 'review_text', 'created_at'],
        'SELECT review_id legacy_id, customer_id legacy_customer_id, appointment_id legacy_appointment_id, rating, review_text, created_at FROM reviews ORDER BY review_id',
    ],
];

$manifest = ['format' => 1, 'generated_at' => gmdate(DATE_ATOM), 'source_database' => $name, 'files' => []];
foreach ($queries as $file => [$columns, $sql]) {
    $count = csvFile($out . DIRECTORY_SEPARATOR . $file, $columns, $pdo->query($sql));
    $manifest['files'][$file] = ['rows' => $count, 'columns' => $columns];
}

// Give the operator a complete mapping worksheet. Auth UUIDs are filled only
// after provisioning users through the supported Admin API; no password
// material is written to this file.
$identityRows = $pdo->query(
    "SELECT 'customer' legacy_kind, customer_id legacy_id, LOWER(email) email FROM customers
     UNION ALL
     SELECT 'staff' legacy_kind, account_id legacy_id, LOWER(email) email FROM staff_accounts
     ORDER BY legacy_kind, legacy_id"
);
$duplicateEmails = $pdo->query(
    "SELECT LOWER(email) email, COUNT(*) total FROM (
       SELECT email FROM customers UNION ALL SELECT email FROM staff_accounts
     ) users WHERE email IS NOT NULL GROUP BY LOWER(email) HAVING COUNT(*) > 1"
)->fetchAll();
if ($duplicateEmails) {
    $emails = implode(', ', array_map(static fn (array $row): string => (string)$row['email'], $duplicateEmails));
    throw new RuntimeException("Duplicate customer/staff emails require manual identity resolution before export: {$emails}");
}
$identityColumns = ['legacy_kind', 'legacy_id', 'email', 'auth_user_id'];
$identityCount = csvFile($out . DIRECTORY_SEPARATOR . 'identity-map-template.csv', $identityColumns, (static function () use ($identityRows): iterable {
    foreach ($identityRows as $row) {
        yield ['legacy_kind' => $row['legacy_kind'], 'legacy_id' => $row['legacy_id'], 'email' => $row['email'], 'auth_user_id' => null];
    }
})());
$manifest['files']['identity-map-template.csv'] = ['rows' => $identityCount, 'columns' => $identityColumns];

file_put_contents($out . DIRECTORY_SEPARATOR . 'manifest.json', json_encode($manifest, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . "\n");
chmod($out . DIRECTORY_SEPARATOR . 'manifest.json', 0600);
fwrite(STDOUT, json_encode($manifest, JSON_PRETTY_PRINT) . "\n");
