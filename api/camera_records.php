<?php
require_once __DIR__ . '/../sc_paths.php';
require_once sc_path('mysql_config.php');

header('Content-Type: application/json');

$conn = mysqli_connect($servername, $username, $password, $database);

if (!$conn) {
    echo json_encode(['success' => false, 'error' => 'Connection failed']);
    exit;
}

// Get last_id parameter for polling (only fetch newer records)
$lastId = isset($_GET['last_id']) ? intval($_GET['last_id']) : 0;

if ($lastId > 0) {
    // Fetch only new records (for AJAX polling)
    $sql = "SELECT id, glos, zOg, videoTop FROM CameraRecords WHERE id > ? ORDER BY id DESC LIMIT 50";
    $stmt = mysqli_prepare($conn, $sql);
    mysqli_stmt_bind_param($stmt, "i", $lastId);
} else {
    // Initial load - get last 50
    $sql = "SELECT id, glos, zOg, videoTop FROM CameraRecords ORDER BY id DESC LIMIT 50";
    $stmt = mysqli_prepare($conn, $sql);
}

mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);

$records = [];
while ($row = mysqli_fetch_assoc($result)) {
    // Parse videoTop (can be JSON array or string)
    $videoFile = '';
    if ($row['videoTop']) {
        $decoded = json_decode($row['videoTop'], true);
        if (is_array($decoded) && isset($decoded[0]['file'])) {
            $videoFile = $decoded[0]['file'];
        } else {
            $videoFile = $row['videoTop'];
        }
    }

    $records[] = [
        'id' => $row['id'],
        'glos' => $row['glos'],
        'zOg' => $row['zOg'],
        'videoUrl' => $videoFile ? 'https://signcollect.nl/uploads/' . $videoFile : ''
    ];
}

echo json_encode(['success' => true, 'records' => $records]);
mysqli_close($conn);
