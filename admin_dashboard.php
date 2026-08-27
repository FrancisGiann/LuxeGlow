<?php
/**
 * Legacy admin entry point retired with the MariaDB/session application.
 * The Supabase-authenticated React staff workspace is the supported surface.
 */
$base = rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? ''), '/\\');
header('Location: ' . ($base ?: '') . '/admin', true, 302);
exit;
