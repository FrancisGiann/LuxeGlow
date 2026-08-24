<?php
// config/mail.php

// 1. Default configuration array with placeholders
$mailConfig = [
    'host'         => $_ENV['MAIL_HOST'] ?? 'smtp.gmail.com',
    'port'         => (int)($_ENV['MAIL_PORT'] ?? 587),
    'encryption'   => $_ENV['MAIL_ENCRYPTION'] ?? 'tls', // 'tls' or 'ssl'
    'username'     => $_ENV['MAIL_USERNAME'] ?? 'YOUR_GMAIL_ADDRESS@gmail.com',
    'password'     => $_ENV['MAIL_PASSWORD'] ?? 'YOUR_GMAIL_APP_PASSWORD',
    'from_address' => $_ENV['MAIL_FROM_ADDRESS'] ?? 'YOUR_GMAIL_ADDRESS@gmail.com',
    'from_name'    => $_ENV['MAIL_FROM_NAME'] ?? 'Astrid Nails & Beauty Bar',
];

// 2. Optional local override file (ignored by Git for real credentials)
$localConfigPath = __DIR__ . '/mail.local.php';
if (file_exists($localConfigPath)) {
    $localConfig = require $localConfigPath;
    if (is_array($localConfig)) {
        $mailConfig = array_merge($mailConfig, $localConfig);
    }
}

return $mailConfig;
