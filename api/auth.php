<?php
// Login check for the dashboard's own endpoints. Their only caller is
// js/dashboard.js on view.php, so the session is the one index.php starts.
// gc_maxlifetime matches index.php/view.php: a request that ran session GC
// with PHP's 24-minute default would expire the dashboard's 1-year sessions.
ini_set('session.gc_maxlifetime', 365 * 24 * 60 * 60);
session_start(['read_and_close' => true]);
if (($_SESSION['logged_in'] ?? false) !== true) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Not logged in']);
    exit;
}
