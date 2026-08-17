/**
 * Client Monitor Dashboard JavaScript
 */

// API Base URL
const API_BASE = '/client_monitor_api/api.php';

// Auto-refresh settings
let autoRefreshInterval = null;
let countdownInterval = null;
let countdownSeconds = 30;

// Current filter
let currentFilter = 'all';

// View settings
let currentView = 'grid'; // Default view
let chartInstances = {}; // Store Chart.js instances
let metricsChartInstances = {}; // Store metrics Chart.js instances
let metricsLoadedIPs = new Set(); // Track which IPs have metrics loaded
let metricsDataCache = {}; // Cache metrics data by IP

// Camera Records settings
let lastCameraRecordId = 0;
let cameraRecordsRefreshInterval = null;

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Restore saved view preference
    const savedView = localStorage.getItem('clientMonitorView') || 'grid';
    currentView = savedView;

    // Initialize view toggle
    initViewToggle();

    // Set initial view state (without reloading data)
    document.querySelectorAll('.view-toggle .btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-view') === currentView);
    });

    if (currentView === 'grid') {
        document.getElementById('grid-view').style.display = 'flex';
        document.getElementById('table-view').style.display = 'none';
    } else {
        document.getElementById('grid-view').style.display = 'none';
        document.getElementById('table-view').style.display = 'block';
    }

    // Load initial data
    loadDashboardData(true);

    // Set up auto-refresh
    startAutoRefresh();

    // Set up filter buttons
    setupFilterButtons();

    // Set up refresh button
    document.getElementById('refresh-btn').addEventListener('click', function() {
        // Clear metrics tracking and cache on manual refresh to reload fresh data
        metricsLoadedIPs.clear();
        metricsDataCache = {};
        destroyAllMetricsCharts();
        destroyAllCharts();

        // Force a full reload
        loadDashboardData(true);
        resetCountdown();
    });

    // Set up edit modal save button
    document.getElementById('save-client-btn').addEventListener('click', saveClientChanges);

    // Set up delete modal confirm button
    document.getElementById('confirm-delete-btn').addEventListener('click', confirmDeleteClient);

    // Start camera records polling
    startCameraRecordsPolling();

    // Load transcription stats
    loadTranscriptionStats();

    // Start live status polling (today's count & LIVE indicator)
    startLiveStatusPolling();
});

/**
 * Load all dashboard data (stats + clients)
 */
function loadDashboardData(isInitialLoad = false) {
    loadStats();
    loadClients(currentFilter, isInitialLoad);
}

/**
 * Load summary statistics
 */
function loadStats() {
    fetch(`${API_BASE}?action=get_stats`)
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                const stats = result.data;
                document.getElementById('stat-total').textContent = stats.total;
                document.getElementById('stat-online').textContent = stats.online;
                document.getElementById('stat-warning').textContent = stats.warning;
                document.getElementById('stat-offline').textContent = stats.offline;
            } else {
                console.error('Failed to load stats:', result.errors);
            }
        })
        .catch(error => {
            console.error('Error loading stats:', error);
        });
}

/**
 * Load clients list
 */
function loadClients(statusFilter = null, isInitialLoad = false) {
    const loading = document.getElementById('loading');
    const errorMessage = document.getElementById('error-message');
    const noClients = document.getElementById('no-clients');
    const gridView = document.getElementById('grid-view');
    const tableView = document.getElementById('table-view');

    // Show loading state only on initial load
    if (isInitialLoad) {
        loading.classList.remove('d-none');
    }

    errorMessage.classList.add('d-none');
    noClients.classList.add('d-none');

    const url = statusFilter && statusFilter !== 'all'
        ? `${API_BASE}?action=get_clients&status=${statusFilter}`
        : `${API_BASE}?action=get_clients`;

    fetch(url)
        .then(response => response.json())
        .then(result => {
            loading.classList.add('d-none');

            if (result.success) {
                const clients = result.data;

                // Store clients data globally for metrics lookup
                window.currentClientsData = clients;

                if (clients.length === 0) {
                    // Show no clients message
                    noClients.classList.remove('d-none');
                    gridView.style.display = 'none';
                    tableView.style.display = 'none';
                } else {
                    // Hide no clients message
                    noClients.classList.add('d-none');

                    // Render based on current view
                    if (currentView === 'grid') {
                        const groupedData = groupClientsByIP(clients);

                        if (isInitialLoad) {
                            // Initial render - build everything
                            renderIPGroups(groupedData);
                        } else {
                            // Update existing cards dynamically
                            updateIPGroups(groupedData);
                        }

                        gridView.style.display = 'flex';
                        tableView.style.display = 'none';
                    } else {
                        if (isInitialLoad) {
                            renderClientsTable(clients);
                        } else {
                            updateClientsTable(clients);
                        }
                        gridView.style.display = 'none';
                        tableView.style.display = 'block';
                    }
                }
            } else {
                showError(result.errors.join(', '));
            }
        })
        .catch(error => {
            loading.classList.add('d-none');
            showError('Failed to load clients: ' + error.message);
        });
}

/**
 * Render clients table
 */
function renderClientsTable(clients) {
    const tbody = document.getElementById('clients-tbody');
    tbody.innerHTML = '';

    clients.forEach(client => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <span class="badge status-badge status-${client.status}">
                    <i class="fas ${getStatusIcon(client.status)} me-1"></i>
                    ${client.status.toUpperCase()}
                </span>
            </td>
            <td>
                <strong>${escapeHtml(client.client_name)}</strong>
                <br>
                <small class="text-muted">${escapeHtml(client.client_id)}</small>
            </td>
            <td>${escapeHtml(client.description || '-')}</td>
            <td>
                ${client.last_seen ? formatRelativeTime(client.last_seen) : 'Never'}
                ${client.last_seen ? '<br><small class="text-muted">' + formatDateTime(client.last_seen) + '</small>' : ''}
            </td>
            <td>${formatInterval(client.heartbeat_interval)}</td>
            <td>${escapeHtml(client.ip_address || '-')}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="openEditModal('${escapeHtml(client.client_id)}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="openDeleteModal('${escapeHtml(client.client_id)}', '${escapeHtml(client.client_name)}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

/**
 * Get status icon
 */
function getStatusIcon(status) {
    switch(status) {
        case 'online': return 'fa-check-circle';
        case 'warning': return 'fa-exclamation-triangle';
        case 'offline': return 'fa-times-circle';
        default: return 'fa-question-circle';
    }
}

/**
 * Format relative time (e.g., "5 minutes ago")
 */
function formatRelativeTime(timestamp) {
    const now = new Date();
    // Parse timestamp as Europe/Amsterdam time by adding timezone offset
    // MySQL returns timestamp in Amsterdam time (UTC+1)
    const time = new Date(timestamp + ' GMT+0100');
    const seconds = Math.floor((now - time) / 1000);

    if (seconds < 60) {
        return 'Just now';
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }

    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
}

/**
 * Format date time
 */
function formatDateTime(timestamp) {
    // Parse timestamp as Europe/Amsterdam time by adding timezone offset
    const date = new Date(timestamp + ' GMT+0100');
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Amsterdam'
    });
}

/**
 * Format interval (seconds to human readable)
 */
function formatInterval(seconds) {
    if (seconds < 60) {
        return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    return `${hours}h`;
}

/**
 * Setup filter buttons
 */
function setupFilterButtons() {
    const filterButtons = document.querySelectorAll('[data-filter]');
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Update active state
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');

            // Update current filter and reload (force full reload on filter change)
            currentFilter = this.dataset.filter;
            loadClients(currentFilter === 'all' ? null : currentFilter, true);
        });
    });
}

/**
 * Start auto-refresh
 */
function startAutoRefresh() {
    // Refresh every 30 seconds
    autoRefreshInterval = setInterval(() => {
        loadDashboardData();
        resetCountdown();
    }, 30000);

    // Update countdown every second
    startCountdown();
}

/**
 * Start countdown timer
 */
function startCountdown() {
    countdownSeconds = 30;
    updateCountdownDisplay();

    countdownInterval = setInterval(() => {
        countdownSeconds--;
        updateCountdownDisplay();

        if (countdownSeconds <= 0) {
            countdownSeconds = 30;
        }
    }, 1000);
}

/**
 * Update countdown display
 */
function updateCountdownDisplay() {
    const countdownElement = document.getElementById('countdown');
    if (countdownElement) {
        countdownElement.textContent = countdownSeconds;
    }
}

/**
 * Reset countdown
 */
function resetCountdown() {
    countdownSeconds = 30;
    updateCountdownDisplay();
}

/**
 * Open edit modal
 */
function openEditModal(clientId) {
    fetch(`${API_BASE}?action=get_client&client_id=${encodeURIComponent(clientId)}`)
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                const client = result.data;

                document.getElementById('edit-client-id').value = client.client_id;
                document.getElementById('edit-client-name').value = client.client_name;
                document.getElementById('edit-description').value = client.description || '';
                document.getElementById('edit-heartbeat-interval').value = client.heartbeat_interval;

                const modal = new bootstrap.Modal(document.getElementById('editClientModal'));
                modal.show();
            } else {
                alert('Failed to load client details: ' + result.errors.join(', '));
            }
        })
        .catch(error => {
            alert('Error loading client: ' + error.message);
        });
}

/**
 * Save client changes
 */
function saveClientChanges() {
    const clientId = document.getElementById('edit-client-id').value;
    const clientName = document.getElementById('edit-client-name').value;
    const description = document.getElementById('edit-description').value;
    const heartbeatInterval = parseInt(document.getElementById('edit-heartbeat-interval').value);

    const updateData = {
        client_id: clientId,
        client_name: clientName,
        description: description,
        heartbeat_interval: heartbeatInterval
    };

    fetch(`${API_BASE}?action=update_client`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('editClientModal'));
            modal.hide();

            // Reload data
            loadDashboardData();

            // Show success message (optional)
            showSuccessToast('Client updated successfully');
        } else {
            alert('Failed to update client: ' + result.errors.join(', '));
        }
    })
    .catch(error => {
        alert('Error updating client: ' + error.message);
    });
}

/**
 * Open delete modal
 */
function openDeleteModal(clientId, clientName) {
    document.getElementById('delete-client-id').value = clientId;
    document.getElementById('delete-client-name').textContent = clientName;

    const modal = new bootstrap.Modal(document.getElementById('deleteClientModal'));
    modal.show();
}

/**
 * Confirm delete client
 */
function confirmDeleteClient() {
    const clientId = document.getElementById('delete-client-id').value;

    fetch(`${API_BASE}?action=delete_client`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ client_id: clientId })
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('deleteClientModal'));
            modal.hide();

            // Reload data
            loadDashboardData();

            // Show success message (optional)
            showSuccessToast('Client deleted successfully');
        } else {
            alert('Failed to delete client: ' + result.errors.join(', '));
        }
    })
    .catch(error => {
        alert('Error deleting client: ' + error.message);
    });
}

/**
 * Show error message
 */
function showError(message) {
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    errorText.textContent = message;
    errorMessage.classList.remove('d-none');
}

/**
 * Show success toast (optional enhancement)
 */
function showSuccessToast(message) {
    // Simple console log for now
    // Could be enhanced with Bootstrap toasts
    console.log('Success:', message);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Group clients by IP address
 */
function groupClientsByIP(clients) {
    const grouped = {};

    clients.forEach(client => {
        const ip = client.ip_address || 'No IP Address';

        if (!grouped[ip]) {
            grouped[ip] = {
                ip: ip,
                clients: [],
                stats: { total: 0, online: 0, warning: 0, offline: 0 }
            };
        }

        grouped[ip].clients.push(client);
        grouped[ip].stats.total++;
        grouped[ip].stats[client.status]++;
    });

    // Sort by IP (natural sort), "No IP Address" last
    return Object.fromEntries(
        Object.entries(grouped).sort((a, b) => {
            if (a[0] === 'No IP Address') return 1;
            if (b[0] === 'No IP Address') return -1;
            return a[0].localeCompare(b[0], undefined, { numeric: true });
        })
    );
}

/**
 * Create donut chart for IP group
 */
function createIPChart(canvasId, stats) {
    // Destroy existing chart if exists
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Online', 'Warning', 'Offline'],
            datasets: [{
                data: [stats.online, stats.warning, stats.offline],
                backgroundColor: ['#28a745', '#ffc107', '#dc3545'],
                borderColor: '#fff',
                borderWidth: 2,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '65%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed || 0;
                            if (value === 0) return null;
                            return `${context.label}: ${value}`;
                        }
                    }
                }
            }
        }
    });

    chartInstances[canvasId] = chart;
}

/**
 * Format last seen for grid view
 */
function formatLastSeen(timestamp) {
    if (!timestamp) return 'Never';
    return formatRelativeTime(timestamp) + ' (' + formatDateTime(timestamp) + ')';
}

/**
 * Update existing IP groups dynamically (smooth updates without rebuild)
 */
function updateIPGroups(groupedData) {
    const container = document.getElementById('grid-view');

    Object.entries(groupedData).forEach(([ip, data]) => {
        const card = container.querySelector(`[data-ip="${ip}"]`);

        if (!card) {
            // New IP - need to render it
            const tempContainer = document.createElement('div');
            renderSingleIPCard(tempContainer, ip, data);
            container.appendChild(tempContainer.firstChild);
            return;
        }

        // Update process count badge
        const badge = card.querySelector('.badge.bg-secondary');
        if (badge) {
            const newCount = `${data.stats.total} process${data.stats.total !== 1 ? 'es' : ''}`;
            if (badge.textContent !== newCount) {
                badge.classList.add('badge-pulse');
                badge.textContent = newCount;
                setTimeout(() => badge.classList.remove('badge-pulse'), 500);
            }
        }

        // Update status legend
        const legend = card.querySelector('.status-legend');
        if (legend) {
            legend.innerHTML = `
                ${data.stats.online > 0 ? `<span class="badge status-badge-sm status-online"><i class="fas fa-circle me-1"></i>${data.stats.online} Online</span>` : ''}
                ${data.stats.warning > 0 ? `<span class="badge status-badge-sm status-warning"><i class="fas fa-circle me-1"></i>${data.stats.warning} Warning</span>` : ''}
                ${data.stats.offline > 0 ? `<span class="badge status-badge-sm status-offline"><i class="fas fa-circle me-1"></i>${data.stats.offline} Offline</span>` : ''}
            `;
        }

        // Update donut chart
        const chartId = `chart-${ip.replace(/\./g, '-').replace(/\s/g, '-')}`;
        if (chartInstances[chartId]) {
            chartInstances[chartId].data.datasets[0].data = [data.stats.online, data.stats.warning, data.stats.offline];
            chartInstances[chartId].update('none'); // Update without animation for smooth feel
        }

        // Update workers list
        const hasOffline = data.stats.offline > 0;
        const processListId = `processes-${ip.replace(/\./g, '-').replace(/\s/g, '-')}`;
        const processList = document.getElementById(processListId);
        const processToggle = card.querySelector(`[data-bs-target="#${processListId}"]`);

        if (processList) {
            if (hasOffline) {
                // Auto-expand if there are offline workers
                if (!processList.classList.contains('show')) {
                    processList.classList.add('show');
                }

                // Check if currently showing all workers
                const showingAll = processList.dataset.showingAll === 'true';

                // Update button text based on state
                if (processToggle) {
                    if (showingAll) {
                        processToggle.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i>Show Offline Only (${data.stats.offline})`;
                    } else {
                        processToggle.innerHTML = `<i class="fas fa-list me-2"></i>Show All Workers (${data.stats.total})`;
                    }
                }

                // Sort workers: offline first, then warning, then online
                const sortedWorkers = [...data.clients].sort((a, b) => {
                    const order = { offline: 0, warning: 1, online: 2 };
                    return order[a.status] - order[b.status];
                });

                const workersToShow = showingAll ? sortedWorkers : data.clients.filter(c => c.status === 'offline');

                // Update worker list
                const listContainer = processList.querySelector('.list-group');
                if (listContainer) {
                    listContainer.innerHTML = workersToShow.map(client => `
                        <li class="list-group-item bg-transparent process-list-item">
                            <div class="process-info">
                                <strong>${escapeHtml(client.client_name)}</strong>
                                ${client.description ? `<br><small class="text-muted">${escapeHtml(client.description)}</small>` : ''}
                                <br><small class="text-muted">${formatLastSeen(client.last_seen)}</small>
                            </div>
                            <div class="process-actions">
                                <span class="badge status-${client.status}">
                                    <i class="fas ${getStatusIcon(client.status)}"></i>
                                </span>
                                <button class="btn btn-sm btn-outline-primary" onclick="openEditModal('${escapeHtml(client.client_id)}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="openDeleteModal('${escapeHtml(client.client_id)}', '${escapeHtml(client.client_name)}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </li>
                    `).join('');
                }
            } else {
                // No offline workers - collapse and show all workers when expanded
                if (processList.classList.contains('show')) {
                    processList.classList.remove('show');
                }

                if (processToggle) {
                    processToggle.innerHTML = `<i class="fas fa-list me-2"></i>Show All Workers (${data.stats.total})`;
                }

                // Update worker list with all workers
                const listContainer = processList.querySelector('.list-group');
                if (listContainer) {
                    listContainer.innerHTML = data.clients.map(client => `
                        <li class="list-group-item bg-transparent process-list-item">
                            <div class="process-info">
                                <strong>${escapeHtml(client.client_name)}</strong>
                                ${client.description ? `<br><small class="text-muted">${escapeHtml(client.description)}</small>` : ''}
                                <br><small class="text-muted">${formatLastSeen(client.last_seen)}</small>
                            </div>
                            <div class="process-actions">
                                <span class="badge status-${client.status}">
                                    <i class="fas ${getStatusIcon(client.status)}"></i>
                                </span>
                                <button class="btn btn-sm btn-outline-primary" onclick="openEditModal('${escapeHtml(client.client_id)}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="openDeleteModal('${escapeHtml(client.client_id)}', '${escapeHtml(client.client_name)}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </li>
                    `).join('');
                }

                processList.dataset.showingAll = 'false';
            }
        }
    });

    // Remove cards for IPs that no longer exist
    const existingCards = container.querySelectorAll('.ip-group-card');
    existingCards.forEach(card => {
        const ip = card.getAttribute('data-ip');
        if (!groupedData[ip]) {
            card.classList.add('fade-out');
            setTimeout(() => card.remove(), 300);
        }
    });
}

/**
 * Update clients table dynamically
 */
function updateClientsTable(clients) {
    const tbody = document.getElementById('clients-tbody');
    const existingRows = {};

    // Map existing rows by client_id
    tbody.querySelectorAll('tr').forEach(row => {
        const clientId = row.querySelector('small.text-muted')?.textContent;
        if (clientId) {
            existingRows[clientId] = row;
        }
    });

    // Update or create rows
    clients.forEach(client => {
        const existingRow = existingRows[client.client_id];

        if (existingRow) {
            // Update existing row
            const statusBadge = existingRow.querySelector('.status-badge');
            if (statusBadge) {
                statusBadge.className = `badge status-badge status-${client.status}`;
                statusBadge.innerHTML = `<i class="fas ${getStatusIcon(client.status)} me-1"></i>${client.status.toUpperCase()}`;
            }

            const lastSeenCell = existingRow.querySelectorAll('td')[3];
            if (lastSeenCell) {
                lastSeenCell.innerHTML = `
                    ${client.last_seen ? formatRelativeTime(client.last_seen) : 'Never'}
                    ${client.last_seen ? '<br><small class="text-muted">' + formatDateTime(client.last_seen) + '</small>' : ''}
                `;
            }

            delete existingRows[client.client_id];
        } else {
            // Add new row
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <span class="badge status-badge status-${client.status}">
                        <i class="fas ${getStatusIcon(client.status)} me-1"></i>
                        ${client.status.toUpperCase()}
                    </span>
                </td>
                <td>
                    <strong>${escapeHtml(client.client_name)}</strong>
                    <br>
                    <small class="text-muted">${escapeHtml(client.client_id)}</small>
                </td>
                <td>${escapeHtml(client.description || '-')}</td>
                <td>
                    ${client.last_seen ? formatRelativeTime(client.last_seen) : 'Never'}
                    ${client.last_seen ? '<br><small class="text-muted">' + formatDateTime(client.last_seen) + '</small>' : ''}
                </td>
                <td>${formatInterval(client.heartbeat_interval)}</td>
                <td>${escapeHtml(client.ip_address || '-')}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="openEditModal('${escapeHtml(client.client_id)}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="openDeleteModal('${escapeHtml(client.client_id)}', '${escapeHtml(client.client_name)}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            row.classList.add('fade-in');
            tbody.appendChild(row);
        }
    });

    // Remove rows for clients that no longer exist
    Object.values(existingRows).forEach(row => {
        row.classList.add('fade-out');
        setTimeout(() => row.remove(), 300);
    });
}

/**
 * Render single IP card (used for new cards during updates)
 */
function renderSingleIPCard(container, ip, data) {
    const chartId = `chart-${ip.replace(/\./g, '-').replace(/\s/g, '-')}`;
    const processListId = `processes-${ip.replace(/\./g, '-').replace(/\s/g, '-')}`;
    const hasOffline = data.stats.offline > 0;
    const processListClass = hasOffline ? 'collapse show' : 'collapse';

    // Sort workers: offline first, then warning, then online
    const sortedWorkers = [...data.clients].sort((a, b) => {
        const order = { offline: 0, warning: 1, online: 2 };
        return order[a.status] - order[b.status];
    });

    // Show only offline workers by default
    const workersToShow = hasOffline ? data.clients.filter(c => c.status === 'offline') : data.clients;
    const ipIcon = ip === 'No IP Address' ? 'fa-question-circle' : 'fa-network-wired';

    const card = document.createElement('div');
    card.className = 'col-12 col-md-6 col-lg-4 mb-4 ip-group-card fade-in';
    card.setAttribute('data-ip', ip);

    card.innerHTML = `
        <div class="card border-0 shadow-sm h-100">
            <!-- Header -->
            <div class="card-header bg-white border-0 d-flex justify-content-between align-items-center">
                <h6 class="mb-0">
                    <i class="fas ${ipIcon} me-2 text-primary"></i>
                    <span class="ip-address">${escapeHtml(ip)}</span>
                </h6>
                <span class="badge bg-secondary">${data.stats.total} process${data.stats.total !== 1 ? 'es' : ''}</span>
            </div>

            <!-- Chart + Legend -->
            <div class="card-body text-center pb-2">
                <div class="chart-container mb-3">
                    <canvas id="${chartId}" width="150" height="150"></canvas>
                </div>

                <div class="status-legend mb-3">
                    ${data.stats.online > 0 ? `<span class="badge status-badge-sm status-online"><i class="fas fa-circle me-1"></i>${data.stats.online} Online</span>` : ''}
                    ${data.stats.warning > 0 ? `<span class="badge status-badge-sm status-warning"><i class="fas fa-circle me-1"></i>${data.stats.warning} Warning</span>` : ''}
                    ${data.stats.offline > 0 ? `<span class="badge status-badge-sm status-offline"><i class="fas fa-circle me-1"></i>${data.stats.offline} Offline</span>` : ''}
                </div>
            </div>

            <!-- System Metrics Section (Always Visible) -->
            <div class="card-footer bg-white border-top pt-3 pb-3">
                <h6 class="text-muted mb-3">
                    <i class="fas fa-server me-2"></i>Server Metrics (7 Days)
                </h6>
                <div id="metrics-${ip.replace(/\./g, '-').replace(/\s/g, '-')}">
                    <!-- Metrics charts will be inserted here dynamically -->
                </div>
            </div>

            <!-- Process List Toggle Button -->
            <div class="card-footer bg-light border-top pt-2 pb-2">
                <button class="btn btn-sm btn-outline-secondary w-100 worker-toggle-btn"
                        type="button"
                        ${!hasOffline ? `data-bs-toggle="collapse" data-bs-target="#${processListId}"` : ''}>
                    <i class="fas fa-list me-2"></i>
                    ${hasOffline ? `Show All Workers (${data.stats.total})` : `Show All Workers (${data.stats.total})`}
                </button>
            </div>

            <!-- Process List (Collapsible) -->
            <div class="${processListClass}" id="${processListId}">
                <div class="card-footer bg-light border-0 pt-0 px-0">
                    <ul class="list-group list-group-flush">
                        ${workersToShow.map(client => `
                            <li class="list-group-item bg-transparent process-list-item">
                                <div class="process-info">
                                    <strong>${escapeHtml(client.client_name)}</strong>
                                    ${client.description ? `<br><small class="text-muted">${escapeHtml(client.description)}</small>` : ''}
                                    <br><small class="text-muted">${formatLastSeen(client.last_seen)}</small>
                                </div>
                                <div class="process-actions">
                                    <span class="badge status-${client.status}">
                                        <i class="fas ${getStatusIcon(client.status)}"></i>
                                    </span>
                                    <button class="btn btn-sm btn-outline-primary" onclick="openEditModal('${escapeHtml(client.client_id)}')">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline-danger" onclick="openDeleteModal('${escapeHtml(client.client_id)}', '${escapeHtml(client.client_name)}')">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        </div>
    `;

    container.appendChild(card);

    // Create chart after DOM insertion
    createIPChart(chartId, data.stats);

    // Auto-load metrics for this IP
    loadMetricsForIP(ip);

    // Add toggle functionality for worker list
    const processList = document.getElementById(processListId);
    const processToggle = card.querySelector('.worker-toggle-btn');

    if (processToggle && processList && hasOffline) {
        // Initialize state: showing offline only
        processList.dataset.showingAll = 'false';

        // Add click handler to toggle between all workers and offline-only
        processToggle.addEventListener('click', function(e) {
            e.preventDefault();

            // Toggle between showing all workers and offline only
            const showingAll = processList.dataset.showingAll === 'true';
            processList.dataset.showingAll = (!showingAll).toString();

            // Update worker list based on new state
            const listContainer = processList.querySelector('.list-group');
            if (listContainer) {
                const workersToDisplay = showingAll ? data.clients.filter(c => c.status === 'offline') : sortedWorkers;

                listContainer.innerHTML = workersToDisplay.map(client => `
                    <li class="list-group-item bg-transparent process-list-item">
                        <div class="process-info">
                            <strong>${escapeHtml(client.client_name)}</strong>
                            ${client.description ? `<br><small class="text-muted">${escapeHtml(client.description)}</small>` : ''}
                            <br><small class="text-muted">${formatLastSeen(client.last_seen)}</small>
                        </div>
                        <div class="process-actions">
                            <span class="badge status-${client.status}">
                                <i class="fas ${getStatusIcon(client.status)}"></i>
                            </span>
                            <button class="btn btn-sm btn-outline-primary" onclick="openEditModal('${escapeHtml(client.client_id)}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="openDeleteModal('${escapeHtml(client.client_id)}', '${escapeHtml(client.client_name)}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </li>
                `).join('');
            }

            // Update button text
            if (!showingAll) {
                // Now showing all, so button should offer to show offline only
                processToggle.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i>Show Offline Only (${data.stats.offline})`;
            } else {
                // Now showing offline only, so button should offer to show all
                processToggle.innerHTML = `<i class="fas fa-list me-2"></i>Show All Workers (${data.stats.total})`;
            }
        });
    }
}

/**
 * Render IP group cards
 */
function renderIPGroups(groupedData) {
    const container = document.getElementById('grid-view');
    container.innerHTML = '';

    Object.entries(groupedData).forEach(([ip, data]) => {
        const chartId = `chart-${ip.replace(/\./g, '-').replace(/\s/g, '-')}`;
        const processListId = `processes-${ip.replace(/\./g, '-').replace(/\s/g, '-')}`;

        // Determine if should auto-expand (only if offline workers exist)
        const hasOffline = data.stats.offline > 0;
        const processListClass = hasOffline ? 'collapse show' : 'collapse';

        // Sort workers: offline first, then warning, then online
        const sortedWorkers = [...data.clients].sort((a, b) => {
            const order = { offline: 0, warning: 1, online: 2 };
            return order[a.status] - order[b.status];
        });

        // Filter to show only offline workers by default
        const workersToShow = hasOffline ? data.clients.filter(c => c.status === 'offline') : data.clients;

        const card = document.createElement('div');
        card.className = 'col-12 col-md-6 col-lg-4 mb-4 ip-group-card';
        card.setAttribute('data-ip', ip);

        const ipIcon = ip === 'No IP Address' ? 'fa-question-circle' : 'fa-network-wired';

        card.innerHTML = `
            <div class="card border-0 shadow-sm h-100">
                <!-- Header -->
                <div class="card-header bg-white border-0 d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">
                        <i class="fas ${ipIcon} me-2 text-primary"></i>
                        <span class="ip-address">${escapeHtml(ip)}</span>
                    </h6>
                    <span class="badge bg-secondary">${data.stats.total} process${data.stats.total !== 1 ? 'es' : ''}</span>
                </div>

                <!-- Chart + Legend -->
                <div class="card-body text-center pb-2">
                    <div class="chart-container mb-3">
                        <canvas id="${chartId}" width="150" height="150"></canvas>
                    </div>

                    <div class="status-legend mb-3">
                        ${data.stats.online > 0 ? `<span class="badge status-badge-sm status-online"><i class="fas fa-circle me-1"></i>${data.stats.online} Online</span>` : ''}
                        ${data.stats.warning > 0 ? `<span class="badge status-badge-sm status-warning"><i class="fas fa-circle me-1"></i>${data.stats.warning} Warning</span>` : ''}
                        ${data.stats.offline > 0 ? `<span class="badge status-badge-sm status-offline"><i class="fas fa-circle me-1"></i>${data.stats.offline} Offline</span>` : ''}
                    </div>
                </div>

                <!-- System Metrics Section (Always Visible) -->
                <div class="card-footer bg-white border-top pt-3 pb-3">
                    <h6 class="text-muted mb-3">
                        <i class="fas fa-server me-2"></i>Server Metrics (7 Days)
                    </h6>
                    <div id="metrics-${ip.replace(/\./g, '-').replace(/\s/g, '-')}">
                        <!-- Metrics charts will be inserted here dynamically -->
                    </div>
                </div>

                <!-- Process List Toggle Button -->
                <div class="card-footer bg-light border-top pt-2 pb-2">
                    <button class="btn btn-sm btn-outline-secondary w-100 worker-toggle-btn"
                            type="button"
                            ${!hasOffline ? `data-bs-toggle="collapse" data-bs-target="#${processListId}"` : ''}>
                        <i class="fas fa-list me-2"></i>
                        ${hasOffline ? `Show All Workers (${data.stats.total})` : `Show All Workers (${data.stats.total})`}
                    </button>
                </div>

                <!-- Process List (Collapsible) -->
                <div class="${processListClass}" id="${processListId}">
                    <div class="card-footer bg-light border-0 pt-0 px-0">
                        <ul class="list-group list-group-flush">
                            ${workersToShow.map(client => `
                                <li class="list-group-item bg-transparent process-list-item">
                                    <div class="process-info">
                                        <strong>${escapeHtml(client.client_name)}</strong>
                                        ${client.description ? `<br><small class="text-muted">${escapeHtml(client.description)}</small>` : ''}
                                        <br><small class="text-muted">${formatLastSeen(client.last_seen)}</small>
                                    </div>
                                    <div class="process-actions">
                                        <span class="badge status-${client.status}">
                                            <i class="fas ${getStatusIcon(client.status)}"></i>
                                        </span>
                                        <button class="btn btn-sm btn-outline-primary" onclick="openEditModal('${escapeHtml(client.client_id)}')">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="btn btn-sm btn-outline-danger" onclick="openDeleteModal('${escapeHtml(client.client_id)}', '${escapeHtml(client.client_name)}')">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            </div>
        `;

        container.appendChild(card);

        // Create chart after DOM insertion
        createIPChart(chartId, data.stats);

        // Auto-load metrics for this IP
        loadMetricsForIP(ip);

        // Add toggle functionality for worker list
        const processList = document.getElementById(processListId);
        const processToggle = card.querySelector('.worker-toggle-btn');

        if (processToggle && processList && hasOffline) {
            // Initialize state: showing offline only
            processList.dataset.showingAll = 'false';

            // Add click handler to toggle between all workers and offline-only
            processToggle.addEventListener('click', function(e) {
                e.preventDefault();

                // Toggle between showing all workers and offline only
                const showingAll = processList.dataset.showingAll === 'true';
                processList.dataset.showingAll = (!showingAll).toString();

                // Update worker list based on new state
                const listContainer = processList.querySelector('.list-group');
                if (listContainer) {
                    const workersToDisplay = showingAll ? data.clients.filter(c => c.status === 'offline') : sortedWorkers;

                    listContainer.innerHTML = workersToDisplay.map(client => `
                        <li class="list-group-item bg-transparent process-list-item">
                            <div class="process-info">
                                <strong>${escapeHtml(client.client_name)}</strong>
                                ${client.description ? `<br><small class="text-muted">${escapeHtml(client.description)}</small>` : ''}
                                <br><small class="text-muted">${formatLastSeen(client.last_seen)}</small>
                            </div>
                            <div class="process-actions">
                                <span class="badge status-${client.status}">
                                    <i class="fas ${getStatusIcon(client.status)}"></i>
                                </span>
                                <button class="btn btn-sm btn-outline-primary" onclick="openEditModal('${escapeHtml(client.client_id)}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="openDeleteModal('${escapeHtml(client.client_id)}', '${escapeHtml(client.client_name)}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </li>
                    `).join('');
                }

                // Update button text
                if (!showingAll) {
                    // Now showing all, so button should offer to show offline only
                    processToggle.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i>Show Offline Only (${data.stats.offline})`;
                } else {
                    // Now showing offline only, so button should offer to show all
                    processToggle.innerHTML = `<i class="fas fa-list me-2"></i>Show All Workers (${data.stats.total})`;
                }
            });
        }
    });
}

/**
 * Initialize view toggle
 */
function initViewToggle() {
    document.querySelectorAll('.view-toggle .btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const view = this.getAttribute('data-view');
            switchView(view);
        });
    });
}

/**
 * Switch between grid and table views
 */
function switchView(view) {
    currentView = view;

    // Update button states
    document.querySelectorAll('.view-toggle .btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-view') === view);
    });

    // Toggle visibility
    if (view === 'grid') {
        document.getElementById('grid-view').style.display = 'flex';
        document.getElementById('table-view').style.display = 'none';
    } else {
        document.getElementById('grid-view').style.display = 'none';
        document.getElementById('table-view').style.display = 'block';
    }

    // Save preference
    localStorage.setItem('clientMonitorView', view);

    // Reload data to render in the selected view (force full reload on view change)
    loadClients(currentFilter === 'all' ? null : currentFilter, true);
}

/**
 * Destroy all chart instances
 */
function destroyAllCharts() {
    Object.values(chartInstances).forEach(chart => chart.destroy());
    chartInstances = {};
}

/**
 * Destroy all metrics chart instances
 */
function destroyAllMetricsCharts() {
    Object.values(metricsChartInstances).forEach(chart => {
        try {
            chart.destroy();
        } catch (e) {
            console.warn('Error destroying metrics chart:', e);
        }
    });
    metricsChartInstances = {};
}

/**
 * Load metrics for a server (by IP address)
 */
async function loadMetricsForIP(ip) {
    const chartContainerId = `metrics-${ip.replace(/\./g, '-').replace(/\s/g, '-')}`;
    const container = document.getElementById(chartContainerId);

    if (!container) return;

    // Skip loading for "No IP Address" entries
    if (ip === 'No IP Address') {
        container.innerHTML = '<div class="alert alert-info mb-0 small"><i class="fas fa-info-circle me-2"></i>No IP address available for this server</div>';
        return;
    }

    // Check if we have cached data - if so, render from cache
    if (metricsDataCache[ip]) {
        renderMetricsCharts(chartContainerId, metricsDataCache[ip]);
        return;
    }

    // Check if we're already loading this IP (prevent duplicate API calls)
    if (metricsLoadedIPs.has(ip)) {
        return;
    }

    // Mark as loading
    metricsLoadedIPs.add(ip);

    // Show loading state
    container.innerHTML = '<div class="text-center py-2"><div class="spinner-border spinner-border-sm"></div> <small class="text-muted ms-2">Loading server metrics...</small></div>';

    try {
        // Use server-level client ID: "server-{IP}"
        const serverClientId = `server-${ip}`;

        // Fetch metrics from API
        const response = await fetch(`${API_BASE}?action=get_metrics&client_id=${encodeURIComponent(serverClientId)}&hours=168`);
        const result = await response.json();

        if (!result.success || !result.data.metrics || result.data.metrics.length === 0) {
            container.innerHTML = '<div class="alert alert-warning mb-0 small"><i class="fas fa-exclamation-triangle me-2"></i>No system metrics available yet. The metrics collector will start reporting after installation.</div>';
            return;
        }

        // Cache the data
        metricsDataCache[ip] = result.data;

        // Render charts
        renderMetricsCharts(chartContainerId, result.data);

    } catch (error) {
        console.error('Error loading metrics:', error);
        container.innerHTML = '<div class="alert alert-danger mb-0 small"><i class="fas fa-times-circle me-2"></i>Failed to load metrics</div>';
    }
}

/**
 * Get clients for a specific IP from current data
 */
function getClientsForIP(ip) {
    return window.currentClientsData ?
           window.currentClientsData.filter(c => (c.ip_address || 'No IP Address') === ip) :
           [];
}

/**
 * Render metrics line charts
 */
function renderMetricsCharts(containerId, data) {
    const container = document.getElementById(containerId);

    if (!container) {
        console.warn('Container not found:', containerId);
        return;
    }

    // Check if we're already rendering this container to prevent loops
    if (container.dataset.rendering === 'true') {
        console.warn('Already rendering metrics for:', containerId);
        return;
    }

    // Mark as rendering
    container.dataset.rendering = 'true';

    // Destroy existing charts for this container first
    const chartIds = [`${containerId}-cpu`, `${containerId}-disk`, `${containerId}-wait`];
    chartIds.forEach(chartId => {
        if (metricsChartInstances[chartId]) {
            try {
                metricsChartInstances[chartId].destroy();
                delete metricsChartInstances[chartId];
            } catch (e) {
                console.warn('Error destroying chart:', chartId, e);
            }
        }
    });

    // Prepare data arrays
    const timestamps = data.metrics.map(m => {
        const date = new Date(m.timestamp);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' });
    }).reverse(); // Reverse to show oldest to newest

    const cpuData = data.metrics.map(m => m.cpu_percent).reverse();
    const diskData = data.metrics.map(m => m.disk_usage_percent).reverse();
    const waitData = data.metrics.map(m => m.cpu_wait_percent || 0).reverse();

    // Create HTML structure for 3 charts
    container.innerHTML = `
        <div class="row mt-3">
            <div class="col-md-4 mb-3">
                <h6 class="text-center text-muted mb-2">CPU Usage</h6>
                <div style="position: relative; height: 150px;">
                    <canvas id="${containerId}-cpu" width="300" height="150"></canvas>
                </div>
                <p class="text-center text-muted small mt-2">Avg: ${data.summary.avg_cpu}% | Max: ${data.summary.max_cpu}%</p>
            </div>
            <div class="col-md-4 mb-3">
                <h6 class="text-center text-muted mb-2">Disk Usage</h6>
                <div style="position: relative; height: 150px;">
                    <canvas id="${containerId}-disk" width="300" height="150"></canvas>
                </div>
                <p class="text-center text-muted small mt-2">Avg: ${data.summary.avg_disk_usage}%</p>
            </div>
            <div class="col-md-4 mb-3">
                <h6 class="text-center text-muted mb-2">I/O Wait</h6>
                <div style="position: relative; height: 150px;">
                    <canvas id="${containerId}-wait" width="300" height="150"></canvas>
                </div>
                <p class="text-center text-muted small mt-2">Avg: ${data.summary.avg_cpu_wait}%</p>
            </div>
        </div>
    `;

    // Create CPU chart
    createMetricsLineChart(`${containerId}-cpu`, timestamps, cpuData, 'CPU Usage', '#007bff');

    // Create Disk chart
    createMetricsLineChart(`${containerId}-disk`, timestamps, diskData, 'Disk Usage', '#fd7e14');

    // Create I/O Wait chart
    createMetricsLineChart(`${containerId}-wait`, timestamps, waitData, 'I/O Wait', '#6f42c1');

    // Clear rendering flag
    setTimeout(() => {
        container.dataset.rendering = 'false';
    }, 100);
}

/**
 * Create a single line chart
 */
function createMetricsLineChart(canvasId, labels, data, label, color) {
    // Destroy existing chart if exists
    if (metricsChartInstances[canvasId]) {
        metricsChartInstances[canvasId].destroy();
    }

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: data,
                borderColor: color,
                backgroundColor: color + '20', // 20% opacity
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHoverBackgroundColor: color,
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2
            }]
        },
        options: {
            responsive: false,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                },
                x: {
                    ticks: {
                        maxTicksLimit: 7,
                        autoSkip: true
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${label}: ${context.parsed.y.toFixed(1)}%`;
                        }
                    }
                }
            }
        }
    });

    metricsChartInstances[canvasId] = chart;
}

/**
 * Load camera records
 */
async function loadCameraRecords(isInitial = false) {
    const url = isInitial
        ? 'api/camera_records.php'
        : `api/camera_records.php?last_id=${lastCameraRecordId}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.success && data.records.length > 0) {
            if (isInitial) {
                renderCameraRecords(data.records);
            } else {
                // New records arrived - prepend and autoplay
                prependCameraRecords(data.records);
                if (data.records[0].videoUrl) {
                    playVideo(data.records[0].videoUrl);
                }
            }
            // Update last known ID
            lastCameraRecordId = Math.max(...data.records.map(r => r.id));
        }
    } catch (error) {
        console.error('Failed to load camera records:', error);
    }
}

/**
 * Render full camera records list
 */
function renderCameraRecords(records) {
    const container = document.getElementById('camera-records-list');
    container.innerHTML = records.map(r => `
        <div class="camera-record-item" data-id="${r.id}" data-video="${escapeHtml(r.videoUrl)}">
            <div class="d-flex justify-content-between">
                <small class="text-primary">${escapeHtml(r.glos || '-')}</small>
                <small class="text-muted">${escapeHtml(r.zOg || '-')}</small>
            </div>
        </div>
    `).join('');

    // Add click handlers to play video
    container.querySelectorAll('.camera-record-item').forEach(item => {
        item.addEventListener('click', () => {
            const videoUrl = item.dataset.video;
            if (videoUrl) playVideo(videoUrl);
        });
    });

    // Play first video on initial load
    if (records.length > 0 && records[0].videoUrl) {
        playVideo(records[0].videoUrl);
    }
}

/**
 * Prepend new camera records (for live updates)
 */
function prependCameraRecords(records) {
    const container = document.getElementById('camera-records-list');
    const newHtml = records.map(r => `
        <div class="camera-record-item new-record" data-id="${r.id}" data-video="${escapeHtml(r.videoUrl)}">
            <div class="d-flex justify-content-between">
                <small class="text-primary">${escapeHtml(r.glos || '-')}</small>
                <small class="text-muted">${escapeHtml(r.zOg || '-')}</small>
            </div>
        </div>
    `).join('');

    container.insertAdjacentHTML('afterbegin', newHtml);

    // Trim list to 50 items
    const items = container.querySelectorAll('.camera-record-item');
    if (items.length > 50) {
        for (let i = 50; i < items.length; i++) {
            items[i].remove();
        }
    }

    // Add click handlers to new items
    records.forEach(r => {
        const item = container.querySelector(`[data-id="${r.id}"]`);
        if (item) {
            item.addEventListener('click', () => {
                if (r.videoUrl) playVideo(r.videoUrl);
            });
        }
    });
}

/**
 * Play video with autoplay
 */
function playVideo(url) {
    const video = document.getElementById('camera-video');
    if (!url) return;

    video.src = url;
    video.load();
    video.play().catch(e => console.log('Autoplay prevented:', e));
}

/**
 * Start camera records polling (every 5 seconds)
 */
function startCameraRecordsPolling() {
    loadCameraRecords(true); // Initial load
    cameraRecordsRefreshInterval = setInterval(() => loadCameraRecords(false), 5000);
}

/**
 * Load transcription statistics (cached 6 hours server-side)
 */
async function loadTranscriptionStats() {
    try {
        const response = await fetch('api/transcription_stats.php');
        const data = await response.json();

        if (data.success) {
            renderTranscriptionStats(data);
        }
    } catch (error) {
        console.error('Failed to load transcription stats:', error);
    }
}

/**
 * Load live status (today's count and live indicator)
 */
async function loadLiveStatus() {
    try {
        const response = await fetch('api/live_status.php');
        const data = await response.json();

        if (data.success) {
            updateLiveIndicator(data);
        }
    } catch (error) {
        console.error('Failed to load live status:', error);
    }
}

/**
 * Update live indicator and today's count in the header
 */
function updateLiveIndicator(data) {
    const liveIndicator = document.getElementById('live-indicator');
    const todayCount = document.getElementById('today-captures-count');

    // Update today's count
    if (todayCount) {
        todayCount.textContent = data.today_count;
    }

    // Update live indicator
    if (data.is_live) {
        liveIndicator.classList.remove('d-none');
        // Flash animation
        liveIndicator.classList.remove('flash');
        void liveIndicator.offsetWidth; // Trigger reflow
        liveIndicator.classList.add('flash');
    } else {
        liveIndicator.classList.add('d-none');
    }
}

/**
 * Start live status polling (every 10 seconds)
 */
function startLiveStatusPolling() {
    loadLiveStatus(); // Initial load
    setInterval(loadLiveStatus, 10000); // Every 10 seconds
}

/**
 * Render transcription statistics with daily breakdown
 */
function renderTranscriptionStats(stats) {
    const container = document.getElementById('transcription-stats');
    const t = stats.totals;

    // Build daily rows (most recent first)
    const dailyRows = stats.daily.map(d => {
        const dateStr = new Date(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        return `
            <tr>
                <td class="text-nowrap">${dateStr}</td>
                <td class="text-end">${d.captures}</td>
                <td class="text-end text-success">${d.match_rate}%</td>
                <td class="text-end text-primary">${d.post_processed_rate}%</td>
                <td class="text-end text-info">${d.converted_rate}%</td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="stat-summary mb-3 p-2 bg-light rounded">
            <div class="row text-center">
                <div class="col-3">
                    <div class="fw-bold">${t.captures}</div>
                    <small class="text-muted">Captures</small>
                </div>
                <div class="col-3">
                    <div class="fw-bold text-success">${t.match_rate}%</div>
                    <small class="text-muted">Matched</small>
                </div>
                <div class="col-3">
                    <div class="fw-bold text-primary">${t.post_processed_rate}%</div>
                    <small class="text-muted">Processed</small>
                </div>
                <div class="col-3">
                    <div class="fw-bold text-info">${t.converted_rate}%</div>
                    <small class="text-muted">Converted</small>
                </div>
            </div>
            <div class="text-center mt-1">
                <small class="text-muted">Last 14 days: ${t.matched}/${t.captures} matched</small>
            </div>
        </div>
        <div class="table-responsive" style="max-height: 300px; overflow-y: auto;">
            <table class="table table-sm table-hover mb-0">
                <thead class="sticky-top bg-white">
                    <tr>
                        <th>Date</th>
                        <th class="text-end">Caps</th>
                        <th class="text-end">Match</th>
                        <th class="text-end">Proc</th>
                        <th class="text-end">Conv</th>
                    </tr>
                </thead>
                <tbody>
                    ${dailyRows}
                </tbody>
            </table>
        </div>
        <small class="text-muted d-block text-end mt-2">Cached: ${stats.cached_at}</small>
    `;
}
