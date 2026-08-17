# Client Monitor Dashboard

## Project Overview
A PHP-based dashboard for monitoring connected clients with real-time status updates using AJAX polling.

## Key Files
- `view.php` - Main dashboard page (316 lines)
- `js/dashboard.js` - JavaScript logic for AJAX, rendering, charts (1434 lines)
- `css/custom.css` - Custom styling with animations (382 lines)
- `index.php` - Login authentication page
- `logout.php` - Session cleanup

## Database
- Connection: `/web/mysql_config.php`
- Database: `admin_gebarenoverleg`
- Tables: `client_monitors`, `client_metrics`, `CameraRecords`

## API
- Location: `/web/client_monitor_api/api.php`
- Pattern: `?action=<endpoint>` with JSON responses
- Uses prepared statements for SQL injection prevention

## Architecture Patterns
- 30-second auto-refresh with countdown timer
- Grid/Table view toggle with localStorage persistence
- Bootstrap 5 responsive design
- Chart.js for data visualization
