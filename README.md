# signlab_client_monitor_dashboard
Web dashboard for the client monitor: which scripts and services are alive, plus a live feed of studio recordings.

## What it does
- `index.php` checks logins against the `users` table (PHP session). `view.php` is the dashboard. `logout.php` ends the session.
- `js/dashboard.js` calls `/client_monitor_api/api.php` from the browser every 30 s. It shows a table or cards grouped by IP (the choice is kept in `localStorage`). You can edit and delete clients. Chart.js graphs show the last week of CPU, I/O wait and disk.
- `api/` has the dashboard's own endpoints, which read `CameraRecords` directly:
  - `live_status.php`: today's count and the latest recording.
  - `camera_records.php`: the 50 newest rows.
  - `transcription_stats.php`: counts per day, cached for 6 h in `/tmp/transcription_stats_cache.json`.
- API reference, status rules and client examples: [signlab_client_monitor_api](https://github.com/Amsterdam-Humanities-Labs/signlab_client_monitor_api).

## Where it runs
- Core server: `/web/client_monitor_dashboard`, `https://signcollect.nl/client_monitor_dashboard/`.
- It needs the API on the same origin at `/client_monitor_api/`. Not on the demo hosts.

## Status
Production.

## How to run / deploy
- No build step. Put the tree at `/web/client_monitor_dashboard`, with signlab_client_monitor_api next to it at `/web/client_monitor_api`.
- `interface_deploy` does not deploy it (no `repos.tsv` row). TODO: document how the core server gets updated.
- Troubleshooting: `/web/client_monitor_dashboard/php_errors.log` and the browser console.

## Configuration
| What | Where |
|---|---|
| Database credentials | docroot `mysql_config.php`. `index.php` uses `../mysql_config.php`. `api/*.php` use `<root>/mysql_config.php` through the vendored `sc_paths.php` (`SC_WEB_ROOT`, default `/web`; edit it in [signlab_signcollect-lib](https://github.com/Amsterdam-Humanities-Labs/signlab_signcollect-lib)) |
| Logins | rows in `users`; passwords are compared as stored |
| API location | `API_BASE` in `js/dashboard.js` |
| Sessions | 1-year cookie with `secure`, `httponly` and `SameSite=Lax`, so HTTPS only |

Auth ([stack#31](https://github.com/Amsterdam-Humanities-Labs/signlab_signcollect-stack/issues/31)): `api/*.php` return 401 without the dashboard login (`api/auth.php`). The API's read, edit and delete actions check the same session. Its ingestion actions stay open.

## Dependencies
- [signlab_client_monitor_api](https://github.com/Amsterdam-Humanities-Labs/signlab_client_monitor_api) for all client, stats and metrics data.
- MySQL `admin_gebarenoverleg`: `users` and `CameraRecords`, plus `client_monitors` and `client_metrics` through the API.
- Bootstrap 5 and Chart.js from a CDN.
- Stack overview: [signlab_signcollect-stack](https://github.com/Amsterdam-Humanities-Labs/signlab_signcollect-stack).

## License and citation

Apache License 2.0, copyright University of Amsterdam: see [LICENSE](LICENSE) and
[NOTICE](NOTICE). You may use it, also commercially, as long as you credit
Gomer Otterspeer / University of Amsterdam as the source. To cite it, use
[CITATION.cff](CITATION.cff) (the *Cite this repository* button on GitHub) or the DOI [10.21942/uva.33980320](https://doi.org/10.21942/uva.33980320).
