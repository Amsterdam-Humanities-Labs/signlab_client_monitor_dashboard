# signlab_client_monitor_dashboard
Web dashboard for the client monitor: which scripts and services are alive, plus a live studio-capture feed.

## What it does
- `index.php` logs in against the `users` table (PHP session); `view.php` is the dashboard; `logout.php` ends the session.
- `js/dashboard.js` calls `/client_monitor_api/api.php` from the browser every 30 s: table view or cards grouped by IP (choice kept in `localStorage`), edit/delete clients, Chart.js graphs of the last week of CPU, I/O wait and disk.
- `api/` holds the dashboard's own endpoints, which read `CameraRecords` directly: `live_status.php` (today's count, latest capture), `camera_records.php` (50 newest rows), `transcription_stats.php` (per-day counts, cached 6 h in `/tmp/transcription_stats_cache.json`).
- API reference, status rules and client examples: [signlab_client_monitor_api](https://github.com/Amsterdam-Humanities-Labs/signlab_client_monitor_api).

## Where it runs
- Production VPS, `/web/client_monitor_dashboard`, `https://signcollect.nl/client_monitor_dashboard/`.
- Needs the API on the same origin at `/client_monitor_api/`. Not on demo hosts.

## Status
Production.

## How to run / deploy
- No build step. Put the tree at `/web/client_monitor_dashboard` with `signlab_client_monitor_api` next to it at `/web/client_monitor_api`.
- Not deployed by `interface_deploy` (no `repos.tsv` row). TODO: document how production gets updated.
- Troubleshooting: `/web/client_monitor_dashboard/php_errors.log` and the browser console.

## Configuration
| What | Where |
|---|---|
| DB credentials | docroot `mysql_config.php`: `index.php` uses `../mysql_config.php`, `api/*.php` hardcode `/web/mysql_config.php` |
| Logins | rows in `users`; passwords compared as stored |
| API location | `API_BASE` in `js/dashboard.js` |
| Sessions | 1-year cookie, `secure` + `httponly` + `SameSite=Lax`, so HTTPS only |

Auth ([stack#31](https://github.com/Amsterdam-Humanities-Labs/signlab_signcollect-stack/issues/31)): `api/*.php` answer 401 without the dashboard login (`api/auth.php`). The API's read/edit/delete actions check the same session; its ingestion actions stay open.

## Dependencies
- `signlab_client_monitor_api` (all client, stats and metrics data).
- MySQL `admin_gebarenoverleg`: `users`, `CameraRecords` (+ `client_monitors`, `client_metrics` through the API).
- Bootstrap 5 and Chart.js from a CDN.
- Stack overview: https://github.com/Amsterdam-Humanities-Labs/signlab_signcollect-stack
