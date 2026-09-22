<?php
require_once __DIR__ . '/auth.php';
require_once '/web/mysql_config.php';

header('Content-Type: application/json');

$conn = mysqli_connect($servername, $username, $password, $database);
if (!$conn) {
    echo json_encode(['success' => false, 'error' => 'Connection failed']);
    exit;
}

// Get today's capture count and last capture time
$query = "
    SELECT
        COUNT(*) as today_count,
        MAX(datetime_ms) as last_capture_ms
    FROM CameraRecords
    WHERE DATE(FROM_UNIXTIME(datetime_ms / 1000)) = CURDATE()
";
$result = mysqli_fetch_assoc(mysqli_query($conn, $query));

$todayCount = (int)($result['today_count'] ?? 0);
$lastCaptureMs = $result['last_capture_ms'] ? (int)$result['last_capture_ms'] : null;
$lastCaptureTime = $lastCaptureMs ? date('Y-m-d H:i:s', $lastCaptureMs / 1000) : null;
$isLive = $lastCaptureMs && ((time() * 1000) - $lastCaptureMs) < (5 * 60 * 1000); // within 5 minutes

echo json_encode([
    'success' => true,
    'today_count' => $todayCount,
    'last_capture_time' => $lastCaptureTime,
    'is_live' => $isLive
]);

mysqli_close($conn);
