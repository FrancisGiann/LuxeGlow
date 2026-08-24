<?php
/**
 * Legacy entry point — retired in Phase 4.
 * The customer-facing frontend is now a React app served from index.html.
 * This stub keeps old links (bookmarks, staff logout redirect) working by
 * forwarding to the React home page, preserving query args like ?openAuth=login.
 */

$queryString = $_SERVER['QUERY_STRING'] ?? '';

header('Location: ./' . ($queryString !== '' ? '?' . $queryString : ''), true, 302);
exit;
