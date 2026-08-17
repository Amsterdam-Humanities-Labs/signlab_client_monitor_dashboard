<?php
// Enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/php_errors.log');

// Debug: Log all POST attempts
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    error_log("Login attempt - User: " . ($_POST['username'] ?? 'none') . " at " . date('Y-m-d H:i:s'));
}

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

// Include database configuration
require_once '../mysql_config.php';

// Check if form was submitted
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $user = $_POST['username'] ?? '';
    $pass = $_POST['password'] ?? '';

    // Connect to database
    $conn = new mysqli($servername, $username, $password, $database);

    // Check connection
    if ($conn->connect_error) {
        $error = "Connection failed: " . $conn->connect_error;
        error_log("DB Connection Error: " . $conn->connect_error);
    } else {
        // Prepare statement to prevent SQL injection
        $stmt = $conn->prepare("SELECT * FROM users WHERE user = ? AND pass = ?");
        $stmt->bind_param("ss", $user, $pass);
        $stmt->execute();
        $result = $stmt->get_result();

        error_log("Query result: " . $result->num_rows . " rows for user: " . $user);

        if ($result->num_rows === 1) {
            // Login successful
            $userData = $result->fetch_assoc();
            $_SESSION['user_id'] = $userData['userId'];
            $_SESSION['username'] = $userData['user'];
            $_SESSION['logged_in'] = true;

            error_log("Login successful for user: " . $user);

            // Redirect to dashboard
            header('Location: view.php');
            exit;
        } else {
            // Login failed
            $error = "Invalid username or password";
            error_log("Login failed for user: " . $user . " (wrong credentials)");
        }

        $stmt->close();
        $conn->close();
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Client Monitor Dashboard - Login</title>

    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">

    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

    <style>
        html, body {
            height: 100%;
        }

        body {
            display: flex;
            align-items: center;
            padding-top: 40px;
            padding-bottom: 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .form-signin {
            width: 100%;
            max-width: 380px;
            padding: 15px;
            margin: auto;
        }

        .card {
            border: none;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        }

        .form-signin .form-floating:focus-within {
            z-index: 2;
        }

        .form-signin input[type="text"] {
            margin-bottom: -1px;
            border-bottom-right-radius: 0;
            border-bottom-left-radius: 0;
        }

        .form-signin input[type="password"] {
            margin-bottom: 10px;
            border-top-left-radius: 0;
            border-top-right-radius: 0;
        }

        .login-header {
            margin-bottom: 1.5rem;
        }

        .monitor-icon {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            width: 80px;
            height: 80px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
        }
    </style>
</head>
<body>
    <main class="form-signin">
        <div class="card">
            <div class="card-body p-5">
                <form method="post" action="index.php">
                    <div class="login-header text-center">
                        <div class="monitor-icon">
                            <i class="fas fa-heartbeat fa-2x"></i>
                        </div>
                        <h1 class="h3 mb-2 fw-bold">Client Monitor</h1>
                        <p class="text-muted">Dashboard Login</p>
                    </div>

                    <?php if (isset($error)): ?>
                        <div class="alert alert-danger" role="alert">
                            <i class="fas fa-exclamation-circle me-2"></i>
                            <?php echo htmlspecialchars($error); ?>
                        </div>
                    <?php endif; ?>

                    <div class="form-floating mb-3">
                        <input type="text" class="form-control" id="username" name="username" placeholder="Username" required autofocus>
                        <label for="username"><i class="fas fa-user me-2"></i>Username</label>
                    </div>
                    <div class="form-floating mb-3">
                        <input type="password" class="form-control" id="password" name="password" placeholder="Password" required>
                        <label for="password"><i class="fas fa-lock me-2"></i>Password</label>
                    </div>

                    <button class="w-100 btn btn-lg btn-primary" type="submit" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none;">
                        <i class="fas fa-sign-in-alt me-2"></i>Log in
                    </button>
                </form>
            </div>
        </div>
        <p class="mt-4 text-center text-white">&copy; <?php echo date('Y'); ?> Client Monitor Dashboard</p>
    </main>

    <!-- JavaScript Libraries -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
