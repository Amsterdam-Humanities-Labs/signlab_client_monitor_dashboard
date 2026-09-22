<?php
require_once __DIR__ . '/auth.php';
require_once '/web/mysql_config.php';

header('Content-Type: application/json');

$cacheFile = '/tmp/transcription_stats_cache.json';
$cacheLifetime = 6 * 60 * 60; // 6 hours in seconds

// Check cache
if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheLifetime) {
    echo file_get_contents($cacheFile);
    exit;
}

// Connect and fetch fresh data
$conn = mysqli_connect($servername, $username, $password, $database);
if (!$conn) {
    echo json_encode(['success' => false, 'error' => 'Connection failed']);
    exit;
}

// Get today's capture count and last capture time
$todayQuery = "
    SELECT
        COUNT(*) as today_count,
        MAX(datetime_ms) as last_capture_ms
    FROM CameraRecords
    WHERE DATE(FROM_UNIXTIME(datetime_ms / 1000)) = CURDATE()
";
$todayResult = mysqli_fetch_assoc(mysqli_query($conn, $todayQuery));
$todayCount = (int)($todayResult['today_count'] ?? 0);
$lastCaptureMs = $todayResult['last_capture_ms'] ? (int)$todayResult['last_capture_ms'] : null;
$lastCaptureTime = $lastCaptureMs ? date('Y-m-d H:i:s', $lastCaptureMs / 1000) : null;
$isLive = $lastCaptureMs && ((time() * 1000) - $lastCaptureMs) < (5 * 60 * 1000); // within 5 minutes

// Get daily capture counts grouped by date (datetime_ms is milliseconds timestamp)
// Only get days with at least 1 capture
$dailyQuery = "
    SELECT
        DATE(FROM_UNIXTIME(datetime_ms / 1000)) as capture_date,
        COUNT(*) as captures
    FROM CameraRecords
    WHERE datetime_ms >= UNIX_TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 14 DAY)) * 1000
    GROUP BY capture_date
    HAVING captures > 0
    ORDER BY capture_date DESC
";

$dailyResult = mysqli_query($conn, $dailyQuery);
$dailyStats = [];

while ($row = mysqli_fetch_assoc($dailyResult)) {
    $date = $row['capture_date'];
    $captures = (int)$row['captures'];

    // Get matched count for this day
    $matchQuery = "
        SELECT COUNT(DISTINCT cr.id) as cnt
        FROM CameraRecords cr
        INNER JOIN matched_transcriptions mt
            ON cr.glosId = mt.m_transcription AND LOWER(cr.zog) = LOWER(mt.zog)
        WHERE DATE(FROM_UNIXTIME(cr.datetime_ms / 1000)) = '$date'
    ";
    $matched = (int)mysqli_fetch_assoc(mysqli_query($conn, $matchQuery))['cnt'];

    // Get post-processed and converted stats - count distinct matched_transcription records
    $mtQuery = "
        SELECT
            COUNT(DISTINCT mt.id) as mt_count,
            COUNT(DISTINCT CASE WHEN mt.post_processed = 1 THEN mt.id END) as post_processed,
            COUNT(DISTINCT CASE WHEN mt.converted = 1 THEN mt.id END) as converted
        FROM CameraRecords cr
        INNER JOIN matched_transcriptions mt
            ON cr.glosId = mt.m_transcription AND LOWER(cr.zog) = LOWER(mt.zog)
        WHERE DATE(FROM_UNIXTIME(cr.datetime_ms / 1000)) = '$date'
    ";
    $mtStats = mysqli_fetch_assoc(mysqli_query($conn, $mtQuery));
    $mtCount = (int)($mtStats['mt_count'] ?? 0);
    $postProcessed = (int)($mtStats['post_processed'] ?? 0);
    $converted = (int)($mtStats['converted'] ?? 0);

    $dailyStats[] = [
        'date' => $date,
        'captures' => $captures,
        'matched' => $matched,
        'match_rate' => $captures > 0 ? round(($matched / $captures) * 100, 1) : 0,
        'mt_count' => $mtCount,
        'post_processed' => $postProcessed,
        'post_processed_rate' => $mtCount > 0 ? round(($postProcessed / $mtCount) * 100, 1) : 0,
        'converted' => $converted,
        'converted_rate' => $mtCount > 0 ? round(($converted / $mtCount) * 100, 1) : 0
    ];
}

// Overall totals
$totalCaptures = array_sum(array_column($dailyStats, 'captures'));
$totalMatched = array_sum(array_column($dailyStats, 'matched'));
$totalMtCount = array_sum(array_column($dailyStats, 'mt_count'));
$totalPostProcessed = array_sum(array_column($dailyStats, 'post_processed'));
$totalConverted = array_sum(array_column($dailyStats, 'converted'));

$stats = [
    'success' => true,
    'today_count' => $todayCount,
    'last_capture_time' => $lastCaptureTime,
    'is_live' => $isLive,
    'daily' => $dailyStats,
    'totals' => [
        'captures' => $totalCaptures,
        'matched' => $totalMatched,
        'match_rate' => $totalCaptures > 0 ? round(($totalMatched / $totalCaptures) * 100, 1) : 0,
        'mt_count' => $totalMtCount,
        'post_processed' => $totalPostProcessed,
        'post_processed_rate' => $totalMtCount > 0 ? round(($totalPostProcessed / $totalMtCount) * 100, 1) : 0,
        'converted' => $totalConverted,
        'converted_rate' => $totalMtCount > 0 ? round(($totalConverted / $totalMtCount) * 100, 1) : 0
    ],
    'cached_at' => date('Y-m-d H:i:s')
];

// Save to cache
file_put_contents($cacheFile, json_encode($stats));

echo json_encode($stats);
mysqli_close($conn);
