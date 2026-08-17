# Client Monitoring System

A standalone client monitoring system to track external scripts, cron jobs, and services connecting to the server. The system provides API endpoints for client registration and heartbeat updates, plus a web dashboard to view all connected clients with their status.

## Features

- **Client Registration**: Register external scripts/services for monitoring
- **Heartbeat Tracking**: Automatic status updates based on heartbeat intervals
- **Status Monitoring**: Real-time status tracking (Online, Warning, Offline)
- **Web Dashboard**: Beautiful, responsive dashboard with auto-refresh
- **RESTful API**: Easy-to-use JSON API for client integration
- **Session Authentication**: Secure PHP session-based authentication

## Components

### 1. Backend API (`/client_monitor_api/`)

RESTful API for managing client monitoring.

**API Base URL**: `http://your-server/client_monitor_api/api.php`

### 2. Web Dashboard (`/client_monitor_dashboard/`)

Interactive web dashboard for viewing and managing monitored clients.

**Dashboard URL**: `http://your-server/client_monitor_dashboard/`

## Quick Start

### 1. Register a Client

```bash
curl -X POST 'http://your-server/client_monitor_api/api.php?action=register' \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "my-cron-job",
    "client_name": "Daily Backup Job",
    "description": "Runs daily at 2 AM to backup database",
    "heartbeat_interval": 3600,
    "metadata": {
      "version": "1.0.0",
      "server": "prod-01"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "client_id": "my-cron-job",
    "status": "online",
    "created_at": "2024-01-20 10:00:00"
  },
  "errors": []
}
```

### 2. Send Heartbeat

Send heartbeat updates at your configured interval to keep status as "online":

```bash
curl -X POST 'http://your-server/client_monitor_api/api.php?action=heartbeat' \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "my-cron-job"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "online",
    "last_seen": "2024-01-20 11:00:00"
  },
  "errors": []
}
```

### 3. View Dashboard

Access the web dashboard at:
```
http://your-server/client_monitor_dashboard/
```

Login with your existing user credentials from the `users` table.

## API Reference

### 1. Register Client

**Endpoint**: `POST /api.php?action=register`

**Request Body**:
```json
{
  "client_id": "unique-client-id",
  "client_name": "Display Name",
  "description": "Optional description",
  "heartbeat_interval": 3600,
  "metadata": {
    "custom": "data"
  }
}
```

**Parameters**:
- `client_id` (required): Unique identifier for the client
- `client_name` (required): Display name for the client
- `description` (optional): Description of the client
- `heartbeat_interval` (optional): Expected heartbeat interval in seconds (default: 3600)
- `metadata` (optional): Custom JSON metadata

### 2. Send Heartbeat

**Endpoint**: `POST /api.php?action=heartbeat`

**Request Body**:
```json
{
  "client_id": "unique-client-id",
  "metadata": {
    "optional": "updated data"
  }
}
```

### 3. Get All Clients

**Endpoint**: `GET /api.php?action=get_clients&status=online|warning|offline`

**Query Parameters**:
- `status` (optional): Filter by status (online, warning, offline)

**Example**:
```bash
# Get all clients
curl 'http://your-server/client_monitor_api/api.php?action=get_clients'

# Get only offline clients
curl 'http://your-server/client_monitor_api/api.php?action=get_clients&status=offline'
```

### 4. Get Single Client

**Endpoint**: `GET /api.php?action=get_client&client_id=XXX`

**Example**:
```bash
curl 'http://your-server/client_monitor_api/api.php?action=get_client&client_id=my-cron-job'
```

### 5. Update Client

**Endpoint**: `POST /api.php?action=update_client`

**Request Body**:
```json
{
  "client_id": "unique-client-id",
  "client_name": "New Display Name",
  "description": "Updated description",
  "heartbeat_interval": 7200,
  "metadata": {
    "version": "2.0.0"
  }
}
```

### 6. Delete Client

**Endpoint**: `POST /api.php?action=delete_client`

**Request Body**:
```json
{
  "client_id": "unique-client-id"
}
```

### 7. Get Statistics

**Endpoint**: `GET /api.php?action=get_stats`

**Response**:
```json
{
  "success": true,
  "data": {
    "total": 10,
    "online": 7,
    "warning": 2,
    "offline": 1
  },
  "errors": []
}
```

## Status Calculation

Client status is automatically calculated based on the last heartbeat time:

- **Online**: Last heartbeat within `heartbeat_interval × warning_threshold` (default: 1.5)
- **Warning**: Last heartbeat within `heartbeat_interval × offline_threshold` (default: 2.0)
- **Offline**: Last heartbeat exceeds `heartbeat_interval × offline_threshold`

### Example:
For a client with `heartbeat_interval = 3600` seconds (1 hour):
- **Online**: Last seen within 5400 seconds (90 minutes)
- **Warning**: Last seen between 5400-7200 seconds (90-120 minutes)
- **Offline**: Last seen over 7200 seconds (120 minutes)

## Client Integration Examples

### Bash Script (Cron Job)

```bash
#!/bin/bash

# Configuration
API_URL="http://your-server/client_monitor_api/api.php"
CLIENT_ID="backup-cron"
CLIENT_NAME="Daily Backup Job"

# Register client (run once)
register_client() {
  curl -X POST "${API_URL}?action=register" \
    -H "Content-Type: application/json" \
    -d "{
      \"client_id\": \"${CLIENT_ID}\",
      \"client_name\": \"${CLIENT_NAME}\",
      \"description\": \"Daily backup cron job\",
      \"heartbeat_interval\": 3600
    }"
}

# Send heartbeat
send_heartbeat() {
  curl -X POST "${API_URL}?action=heartbeat" \
    -H "Content-Type: application/json" \
    -d "{\"client_id\": \"${CLIENT_ID}\"}"
}

# Your script logic here
echo "Running backup..."
# ... backup logic ...

# Send heartbeat after successful execution
send_heartbeat
echo "Heartbeat sent"
```

### Python Script

```python
import requests
import json
import time

API_URL = "http://your-server/client_monitor_api/api.php"
CLIENT_ID = "python-worker"

def register_client():
    """Register client (run once)"""
    data = {
        "client_id": CLIENT_ID,
        "client_name": "Python Worker",
        "description": "Background processing worker",
        "heartbeat_interval": 3600,
        "metadata": {
            "version": "1.0.0",
            "python_version": "3.9"
        }
    }
    response = requests.post(f"{API_URL}?action=register", json=data)
    return response.json()

def send_heartbeat():
    """Send heartbeat"""
    data = {"client_id": CLIENT_ID}
    response = requests.post(f"{API_URL}?action=heartbeat", json=data)
    return response.json()

# Main worker loop
while True:
    try:
        # Your work here
        print("Processing tasks...")
        time.sleep(10)

        # Send heartbeat every hour
        result = send_heartbeat()
        if result['success']:
            print(f"Heartbeat sent - Status: {result['data']['status']}")
        else:
            print(f"Heartbeat failed: {result['errors']}")

    except Exception as e:
        print(f"Error: {e}")

    time.sleep(3600)  # Wait 1 hour
```

### PHP Script

```php
<?php

define('API_URL', 'http://your-server/client_monitor_api/api.php');
define('CLIENT_ID', 'php-processor');

function registerClient() {
    $data = [
        'client_id' => CLIENT_ID,
        'client_name' => 'PHP Processor',
        'description' => 'Email queue processor',
        'heartbeat_interval' => 3600
    ];

    $ch = curl_init(API_URL . '?action=register');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

    $response = curl_exec($ch);
    curl_close($ch);

    return json_decode($response, true);
}

function sendHeartbeat() {
    $data = ['client_id' => CLIENT_ID];

    $ch = curl_init(API_URL . '?action=heartbeat');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

    $response = curl_exec($ch);
    curl_close($ch);

    return json_decode($response, true);
}

// Your script logic
echo "Processing emails...\n";
// ... processing logic ...

// Send heartbeat
$result = sendHeartbeat();
if ($result['success']) {
    echo "Heartbeat sent - Status: {$result['data']['status']}\n";
}
```

## Dashboard Features

- **Real-time Monitoring**: Auto-refresh every 30 seconds
- **Status Overview**: Summary cards showing total, online, warning, and offline counts
- **Client List**: Detailed table with all client information
- **Filtering**: Filter clients by status (All, Online, Warning, Offline)
- **Edit Client**: Update client name, description, and heartbeat interval
- **Delete Client**: Remove clients from monitoring
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Database Schema

The system uses a single table `client_monitors`:

```sql
CREATE TABLE `client_monitors` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `client_id` VARCHAR(100) NOT NULL UNIQUE,
  `client_name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `status` ENUM('online', 'offline', 'warning') NOT NULL DEFAULT 'offline',
  `last_seen` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `ip_address` VARCHAR(45),
  `metadata` JSON,
  `heartbeat_interval` INT NOT NULL DEFAULT 3600,
  `warning_threshold` DECIMAL(3,2) NOT NULL DEFAULT 1.5,
  `offline_threshold` DECIMAL(3,2) NOT NULL DEFAULT 2.0,
  PRIMARY KEY (`id`),
  KEY `idx_client_id` (`client_id`),
  KEY `idx_status` (`status`),
  KEY `idx_last_seen` (`last_seen`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## Troubleshooting

### Client Not Registering

- Ensure the API URL is correct and accessible
- Check that `client_id` is unique
- Verify the JSON payload is valid

### Status Not Updating

- Confirm heartbeats are being sent at the configured interval
- Check the `last_seen` timestamp in the database
- Verify the `heartbeat_interval` matches your sending frequency

### Dashboard Not Loading

- Ensure you're logged in with valid credentials
- Check browser console for JavaScript errors
- Verify the API endpoints are accessible

### Authentication Issues

- Ensure the `users` table exists and has valid users
- Check session configuration in PHP
- Verify database connection settings in `/web/mysql_config.php`

## Security Considerations

- The API currently has no authentication - consider adding API keys for production
- Always use HTTPS in production environments
- Implement rate limiting to prevent abuse
- Validate and sanitize all input data
- Keep your database credentials secure

## Support

For issues or questions, check the PHP error logs:
- Dashboard: `/web/client_monitor_dashboard/php_errors.log`
- API: PHP error logs configured in your web server

## License

Internal use only.
