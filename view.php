<?php
// Enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/php_errors.log');

// Set session cookie lifetime to 1 year (31536000 seconds)
$oneYear = 365 * 24 * 60 * 60;
session_set_cookie_params([
    'lifetime' => $oneYear,
    'path' => '/',
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Lax'
]);
ini_set('session.gc_maxlifetime', $oneYear);

// Start session
session_start();

// Check if user is logged in
if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
    header('Location: index.php');
    exit;
}

$username = $_SESSION['username'] ?? 'User';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Client Monitor Dashboard</title>

    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">

    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>

    <!-- Custom CSS -->
    <link rel="stylesheet" href="css/custom.css">
</head>
<body>
    <!-- Navigation -->
    <nav class="navbar navbar-expand-lg navbar-dark bg-gradient-primary">
        <div class="container-fluid">
            <a class="navbar-brand" href="view.php">
                <i class="fas fa-heartbeat me-2"></i>
                Client Monitor Dashboard
            </a>
            <span id="live-indicator" class="live-indicator d-none">
                <i class="fas fa-circle me-1"></i>LIVE
                <span class="live-captures-count ms-2"><span id="today-captures-count">0</span> captured today</span>
            </span>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto">
                    <li class="nav-item">
                        <span class="navbar-text text-white me-3">
                            <i class="fas fa-user me-1"></i>
                            <?php echo htmlspecialchars($username); ?>
                        </span>
                    </li>
                    <li class="nav-item">
                        <a class="btn btn-outline-light btn-sm" href="logout.php">
                            <i class="fas fa-sign-out-alt me-1"></i>
                            Logout
                        </a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <!-- Main Content -->
    <div class="container-fluid mt-4">
        <div class="row">
            <!-- Left Column: Dashboard Content -->
            <div class="col-md-9">
        <!-- Summary Cards -->
        <div class="row mb-4" id="summary-cards">
            <div class="col-md-3 col-sm-6 mb-3">
                <div class="card stats-card border-0 shadow-sm">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="text-muted mb-1">Total Clients</h6>
                                <h2 class="mb-0" id="stat-total">
                                    <span class="spinner-border spinner-border-sm" role="status"></span>
                                </h2>
                            </div>
                            <div class="stats-icon bg-primary">
                                <i class="fas fa-server"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-md-3 col-sm-6 mb-3">
                <div class="card stats-card border-0 shadow-sm">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="text-muted mb-1">Online</h6>
                                <h2 class="mb-0 text-success" id="stat-online">
                                    <span class="spinner-border spinner-border-sm" role="status"></span>
                                </h2>
                            </div>
                            <div class="stats-icon bg-success">
                                <i class="fas fa-check-circle"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-md-3 col-sm-6 mb-3">
                <div class="card stats-card border-0 shadow-sm">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="text-muted mb-1">Warning</h6>
                                <h2 class="mb-0 text-warning" id="stat-warning">
                                    <span class="spinner-border spinner-border-sm" role="status"></span>
                                </h2>
                            </div>
                            <div class="stats-icon bg-warning">
                                <i class="fas fa-exclamation-triangle"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-md-3 col-sm-6 mb-3">
                <div class="card stats-card border-0 shadow-sm">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="text-muted mb-1">Offline</h6>
                                <h2 class="mb-0 text-danger" id="stat-offline">
                                    <span class="spinner-border spinner-border-sm" role="status"></span>
                                </h2>
                            </div>
                            <div class="stats-icon bg-danger">
                                <i class="fas fa-times-circle"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Filter and Refresh Controls -->
        <div class="row mb-3">
            <div class="col-md-8">
                <div class="btn-group" role="group">
                    <button type="button" class="btn btn-outline-secondary active" data-filter="all">
                        <i class="fas fa-list me-1"></i>All
                    </button>
                    <button type="button" class="btn btn-outline-success" data-filter="online">
                        <i class="fas fa-check-circle me-1"></i>Online
                    </button>
                    <button type="button" class="btn btn-outline-warning" data-filter="warning">
                        <i class="fas fa-exclamation-triangle me-1"></i>Warning
                    </button>
                    <button type="button" class="btn btn-outline-danger" data-filter="offline">
                        <i class="fas fa-times-circle me-1"></i>Offline
                    </button>
                </div>

                <!-- View Toggle -->
                <div class="btn-group view-toggle ms-3" role="group">
                    <button type="button" class="btn btn-outline-secondary active" data-view="grid">
                        <i class="fas fa-th me-1"></i>Grid
                    </button>
                    <button type="button" class="btn btn-outline-secondary" data-view="table">
                        <i class="fas fa-table me-1"></i>Table
                    </button>
                </div>
            </div>
            <div class="col-md-4 text-end">
                <button type="button" class="btn btn-outline-primary" id="refresh-btn">
                    <i class="fas fa-sync-alt me-1"></i>Refresh
                </button>
                <small class="text-muted ms-2" id="last-update">
                    Auto-refresh in <span id="countdown">30</span>s
                </small>
            </div>
        </div>

        <!-- Loading/Error States (shared between views) -->
        <div class="row">
            <div class="col-12">
                <div id="loading" class="text-center py-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2 text-muted">Loading clients...</p>
                </div>

                <div id="error-message" class="alert alert-danger d-none" role="alert">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    <span id="error-text"></span>
                </div>

                <div id="no-clients" class="text-center py-5 d-none">
                    <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
                    <p class="text-muted">No clients found. Register a client using the API to get started.</p>
                </div>
            </div>
        </div>

        <!-- Grid View Container -->
        <div id="grid-view" class="row">
            <!-- IP group cards will be dynamically inserted here -->
        </div>

        <!-- Table View Container -->
        <div id="table-view" class="row" style="display: none;">
            <div class="col-12">
                <div class="card border-0 shadow-sm">
                    <div class="card-header bg-white border-0 py-3">
                        <h5 class="mb-0">
                            <i class="fas fa-list me-2"></i>Monitored Clients
                        </h5>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive" id="clients-table-container">
                            <table class="table table-hover" id="clients-table">
                                <thead>
                                    <tr>
                                        <th>Status</th>
                                        <th>Client Name</th>
                                        <th>Description</th>
                                        <th>Last Seen</th>
                                        <th>Heartbeat Interval</th>
                                        <th>IP Address</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="clients-tbody">
                                    <!-- Populated by JavaScript -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
            </div><!-- End col-md-9 -->

            <!-- Right Column: Camera Records Panel -->
            <div class="col-md-3">
                <div class="card border-0 shadow-sm camera-records-panel">
                    <div class="card-header bg-white border-0 py-3">
                        <h6 class="mb-0">
                            <i class="fas fa-video me-2"></i>Recent Camera Records
                        </h6>
                    </div>
                    <div class="card-body p-2">
                        <!-- Video Player -->
                        <div class="video-container mb-3">
                            <video id="camera-video" width="320" height="160" muted playsinline>
                                <source src="" type="video/webm">
                            </video>
                        </div>

                        <!-- Records List -->
                        <div class="camera-records-list" id="camera-records-list">
                            <div class="text-center text-muted py-3">
                                <span class="spinner-border spinner-border-sm"></span>
                                Loading...
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Transcription Statistics Panel -->
                <div class="card border-0 shadow-sm mt-3 transcription-stats-panel">
                    <div class="card-header bg-white border-0 py-3">
                        <h6 class="mb-0">
                            <i class="fas fa-chart-pie me-2"></i>Transcription Stats
                        </h6>
                    </div>
                    <div class="card-body p-3" id="transcription-stats">
                        <div class="text-center text-muted py-3">
                            <span class="spinner-border spinner-border-sm"></span>
                            Loading...
                        </div>
                    </div>
                </div>
            </div>
        </div><!-- End row -->
    </div>

    <!-- Edit Client Modal -->
    <div class="modal fade" id="editClientModal" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <i class="fas fa-edit me-2"></i>Edit Client
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <form id="edit-client-form">
                        <input type="hidden" id="edit-client-id">

                        <div class="mb-3">
                            <label for="edit-client-name" class="form-label">Client Name</label>
                            <input type="text" class="form-control" id="edit-client-name" required>
                        </div>

                        <div class="mb-3">
                            <label for="edit-description" class="form-label">Description</label>
                            <textarea class="form-control" id="edit-description" rows="3"></textarea>
                        </div>

                        <div class="mb-3">
                            <label for="edit-heartbeat-interval" class="form-label">Heartbeat Interval (seconds)</label>
                            <input type="number" class="form-control" id="edit-heartbeat-interval" min="60" required>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" id="save-client-btn">
                        <i class="fas fa-save me-1"></i>Save Changes
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div class="modal fade" id="deleteClientModal" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header bg-danger text-white">
                    <h5 class="modal-title">
                        <i class="fas fa-trash me-2"></i>Delete Client
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p>Are you sure you want to delete this client?</p>
                    <p class="mb-0"><strong id="delete-client-name"></strong></p>
                    <input type="hidden" id="delete-client-id">
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-danger" id="confirm-delete-btn">
                        <i class="fas fa-trash me-1"></i>Delete
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- JavaScript Libraries -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>

    <!-- Dashboard JavaScript -->
    <script src="js/dashboard.js"></script>
</body>
</html>
