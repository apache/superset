// Dashboard List and Export Logic

let dashboards = [];
let accessToken = null;
let supersetUrl = null;
let username = null;

// Utility function for delays
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  await loadUserData();
  await loadDashboards();
  setupEventListeners();
});

function setupEventListeners() {
  document.getElementById('refreshBtn').addEventListener('click', () => loadDashboards());
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('searchInput').addEventListener('input', filterDashboards);

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dashboard-menu')) {
      document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.style.display = 'none';
      });
    }
  });
}

async function loadUserData() {
  try {
    // Get URL from storage (set during login)
    const data = await chrome.storage.local.get(['supersetUrl', 'accessToken', 'username']);

    if (!data.accessToken) {
      showError('Not logged in. Please login first.');
      setTimeout(() => {
        window.location.href = 'popup.html';
      }, 2000);
      return;
    }

    if (!data.supersetUrl) {
      showError('Superset URL not configured. Please login first.');
      setTimeout(() => {
        window.location.href = 'popup.html';
      }, 2000);
      return;
    }

    supersetUrl = data.supersetUrl;
    accessToken = data.accessToken;
    username = data.username || 'User';
  } catch (error) {
    console.error('Error loading user data:', error);
    showError('Failed to load user data');
  }
}

async function loadDashboards() {
  showLoading(true);
  hideError();

  try {
    const response = await fetch(`${supersetUrl}/api/v1/dashboard/?q=(page:0,page_size:100)`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Session expired. Please login again.');
      }
      throw new Error(`Failed to fetch dashboards: ${response.status}`);
    }

    const data = await response.json();
    dashboards = data.result || [];

    displayDashboards(dashboards);
    showNotification(`Loaded ${dashboards.length} dashboard(s)`, 'success');
  } catch (error) {
    console.error('Error loading dashboards:', error);
    showError(error.message);
    showEmptyState();
  } finally {
    showLoading(false);
  }
}

function displayDashboards(dashboardList) {
  const container = document.getElementById('dashboardsContainer');
  container.innerHTML = '';

  if (dashboardList.length === 0) {
    showEmptyState();
    return;
  }

  hideEmptyState();

  dashboardList.forEach(dashboard => {
    const card = createDashboardCard(dashboard);
    container.appendChild(card);
  });
}

function createDashboardCard(dashboard) {
  const card = document.createElement('div');
  card.className = 'dashboard-card';

  const owners = dashboard.owners?.map(o => o.username || o.first_name || 'Unknown').join(', ') || 'Unknown';
  const modifiedDate = dashboard.changed_on_delta_humanized || 'Unknown';
  const isPublished = dashboard.published;
  const statusBadge = isPublished
    ? '<span class="status-badge status-published"><img src="icons/check-circle.svg" class="status-icon" alt="Published"> Published</span>'
    : '<span class="status-badge status-draft"><img src="icons/dash-circle.svg" class="status-icon" alt="Draft"> Draft</span>';

  card.innerHTML = `
    <div class="dashboard-header">
      <div class="dashboard-icon">📊</div>
      <div class="dashboard-info">
        <div class="dashboard-title-container">
          <div class="dashboard-title" data-dashboard-id="${dashboard.id}" contenteditable="false" title="Double click to rename">${escapeHtml(dashboard.dashboard_title || 'Untitled Dashboard')}</div>
        </div>
        <div class="dashboard-meta">
          <span class="owner-name"><img src="icons/user.svg" class="meta-icon" alt="Owner"> ${escapeHtml(owners)}</span>
          <span class="modified-date"><img src="icons/clock.svg" class="meta-icon" alt="Modified"> Modified ${escapeHtml(modifiedDate)}</span>
          ${statusBadge}
        </div>
      </div>
      <div class="dashboard-menu">
        <button class="btn-menu" data-dashboard-id="${dashboard.id}">
          <span class="menu-dots">⋮</span>
        </button>
        <div class="dropdown-menu" style="display: none;">
          <button class="dropdown-item browse-data-item" data-dashboard-id="${dashboard.id}" data-dashboard-title="${escapeHtml(dashboard.dashboard_title)}">
            📊 Dashboard Metadata
          </button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item view-details-item" data-dashboard-id="${dashboard.id}">
            ℹ️ Details
          </button>
          <button class="dropdown-item view-charts-item" data-dashboard-id="${dashboard.id}" data-dashboard-title="${escapeHtml(dashboard.dashboard_title)}">
            📊 Charts
          </button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item export-config-item" data-dashboard-id="${dashboard.id}" data-dashboard-title="${escapeHtml(dashboard.dashboard_title)}">
            📦 Export Config
          </button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item open-dashboard-item" data-dashboard-id="${dashboard.id}">
            🔗 Open in Superset
          </button>
          <button class="dropdown-item get-permalink-item" data-dashboard-id="${dashboard.id}" data-dashboard-title="${escapeHtml(dashboard.dashboard_title)}">
            🔗 Get Shareable Link
          </button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item delete-dashboard-item" data-dashboard-id="${dashboard.id}" data-dashboard-title="${escapeHtml(dashboard.dashboard_title)}">
            <img src="icons/trash3.svg" class="dropdown-icon" alt="Delete">
            Delete
          </button>
        </div>
      </div>
    </div>
  `;

  // Add event listeners for 3-dot menu
  const menuBtn = card.querySelector('.btn-menu');
  const dropdownMenu = card.querySelector('.dropdown-menu');

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // Close all other dropdowns
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
      if (menu !== dropdownMenu) {
        menu.style.display = 'none';
      }
    });
    // Toggle this dropdown
    dropdownMenu.style.display = dropdownMenu.style.display === 'none' ? 'block' : 'none';
  });

  // Add event listeners to dropdown items
  card.querySelector('.browse-data-item').addEventListener('click', () => {
    dropdownMenu.style.display = 'none';
    showBrowseDataModal(dashboard.id, dashboard.dashboard_title);
  });

  card.querySelector('.get-permalink-item').addEventListener('click', () => {
    dropdownMenu.style.display = 'none';
    getDashboardPermalink(dashboard.id, dashboard.dashboard_title);
  });

  card.querySelector('.view-details-item').addEventListener('click', () => {
    dropdownMenu.style.display = 'none';
    getDashboardDetails(dashboard.id);
  });

  card.querySelector('.view-charts-item').addEventListener('click', () => {
    dropdownMenu.style.display = 'none';
    getDashboardCharts(dashboard.id, dashboard.dashboard_title);
  });

  card.querySelector('.export-config-item').addEventListener('click', () => {
    dropdownMenu.style.display = 'none';
    exportDashboardConfig(dashboard.id, dashboard.dashboard_title);
  });

  card.querySelector('.open-dashboard-item').addEventListener('click', () => {
    dropdownMenu.style.display = 'none';
    openDashboard(dashboard.id);
  });

  card.querySelector('.delete-dashboard-item').addEventListener('click', () => {
    dropdownMenu.style.display = 'none';
    deleteDashboard(dashboard.id, dashboard.dashboard_title);
  });

  // Make title editable on double click
  const titleElement = card.querySelector('.dashboard-title');
  titleElement.addEventListener('dblclick', () => {
    enableTitleEdit(titleElement, dashboard.id, dashboard.dashboard_title);
  });

  return card;
}

// NEW: Browse Data Modal (like Superset's modal with tabs)
async function showBrowseDataModal(dashboardId, dashboardTitle) {
  const modalContent = `
    <div class="browse-data-modal">
      <div class="browse-tabs">
        <button class="browse-tab active" data-tab="dashboard">Dashboard Data</button>
        <button class="browse-tab" data-tab="export">Export Options</button>
      </div>

      <div class="tab-content" id="dashboard-tab">
        <p class="tab-description">Browse and export data from dashboard charts</p>
        <div id="charts-list-container">
          <p>Loading charts...</p>
        </div>
      </div>

      <div class="tab-content" id="export-tab" style="display: none;">
        <div class="export-section">
          <h3>Export All Chart Data</h3>
          <p class="section-description">Download data from all charts in the dashboard</p>
          <div class="export-buttons">
            <button class="btn btn-info export-all-csv-btn" data-dashboard-id="${dashboardId}" data-dashboard-title="${escapeHtml(dashboardTitle)}">
              ⬇️ Export All as CSV
            </button>
            <button class="btn btn-info export-all-json-btn" data-dashboard-id="${dashboardId}" data-dashboard-title="${escapeHtml(dashboardTitle)}">
              ⬇️ Export All as JSON
            </button>
          </div>
        </div>

        <div class="export-section">
          <h3>Dashboard Exports</h3>
          <p class="section-description">Export the dashboard as image or PDF (uses existing functionality)</p>
          <p class="section-note">Use the "Download" option in the dashboard menu for PDF and PNG exports</p>
        </div>
      </div>
    </div>
  `;

  showInfoModal(`Browse Dashboard Data`, modalContent);

  // Load charts for Dashboard Data tab
  loadChartsForBrowsing(dashboardId, dashboardTitle);

  // Setup tab switching
  const tabs = document.querySelectorAll('.browse-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;

      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Show corresponding content
      document.getElementById('dashboard-tab').style.display = tabName === 'dashboard' ? 'block' : 'none';
      document.getElementById('export-tab').style.display = tabName === 'export' ? 'block' : 'none';
    });
  });

  // Setup export buttons
  const exportCsvBtn = document.querySelector('.export-all-csv-btn');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      hideInfoModal();
      exportAllChartsData(dashboardId, dashboardTitle, 'csv');
    });
  }

  const exportJsonBtn = document.querySelector('.export-all-json-btn');
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      hideInfoModal();
      exportAllChartsData(dashboardId, dashboardTitle, 'json');
    });
  }
}

// Load charts list for browsing (like Superset)
async function loadChartsForBrowsing(dashboardId, dashboardTitle) {
  const container = document.getElementById('charts-list-container');

  try {
    const response = await fetch(`${supersetUrl}/api/v1/dashboard/${dashboardId}/charts`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to load charts: ${response.status}`);
    }

    const data = await response.json();
    const charts = data.result || [];

    if (charts.length === 0) {
      container.innerHTML = '<p>No charts found in this dashboard</p>';
      return;
    }

    // Display charts list like Superset (initially with "Loading..." for row count)
    const chartsHtml = charts.map(chart => `
      <div class="chart-browse-item" data-chart-id="${chart.id}">
        <div class="chart-browse-header">
          <span class="chart-browse-icon">📊</span>
          <span class="chart-browse-name">${escapeHtml(chart.slice_name)}</span>
        </div>
        <div class="chart-browse-meta">
          <span class="chart-browse-type">📈 ${escapeHtml(chart.viz_type || 'Unknown')}</span>
          <span class="chart-browse-rows" id="row-count-${chart.id}">Loading...</span>
        </div>
        <div class="chart-browse-actions">
          <button class="btn btn-sm btn-info export-chart-csv" data-chart-id="${chart.id}" data-chart-name="${escapeHtml(chart.slice_name)}">
            📄 CSV
          </button>
          <button class="btn btn-sm btn-info export-chart-json" data-chart-id="${chart.id}" data-chart-name="${escapeHtml(chart.slice_name)}">
            📋 JSON
          </button>
        </div>
      </div>
    `).join('');

    container.innerHTML = chartsHtml;

    // Load row counts asynchronously for each chart
    charts.forEach(async (chart) => {
      try {
        const chartData = await getChartData(chart.id);
        const rowCount = Array.isArray(chartData) ? chartData.length : 0;
        const rowCountElement = document.getElementById(`row-count-${chart.id}`);
        if (rowCountElement) {
          rowCountElement.textContent = `${rowCount} rows`;
        }
      } catch (error) {
        console.error(`Error loading row count for chart ${chart.id}:`, error);
        const rowCountElement = document.getElementById(`row-count-${chart.id}`);
        if (rowCountElement) {
          rowCountElement.textContent = 'N/A';
        }
      }
    });

    // Add event listeners for individual chart exports
    container.querySelectorAll('.export-chart-csv').forEach(btn => {
      btn.addEventListener('click', () => {
        const chartId = btn.dataset.chartId;
        const chartName = btn.dataset.chartName;
        exportSingleChartData(chartId, chartName, 'csv');
      });
    });

    container.querySelectorAll('.export-chart-json').forEach(btn => {
      btn.addEventListener('click', () => {
        const chartId = btn.dataset.chartId;
        const chartName = btn.dataset.chartName;
        exportSingleChartData(chartId, chartName, 'json');
      });
    });

  } catch (error) {
    console.error('Error loading charts:', error);
    container.innerHTML = `<p class="error-text">Failed to load charts: ${error.message}</p>`;
  }
}

// Get chart data from Superset API
async function getChartData(chartId) {
  try {
    // First, get the chart details to get the query_context
    const chartResponse = await fetch(`${supersetUrl}/api/v1/chart/${chartId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      credentials: 'include'
    });

    if (!chartResponse.ok) {
      throw new Error(`Failed to get chart details: ${chartResponse.status}`);
    }

    const chartData = await chartResponse.json();
    const chart = chartData.result;

    // Check if chart has query_context
    if (!chart.query_context) {
      throw new Error('This chart has no saved query');
    }

    // Parse query_context
    const queryContext = JSON.parse(chart.query_context);

    // Get CSRF token for POST request
    const csrfToken = await getCSRFToken();

    // Use POST /data endpoint with the query context
    const dataResponse = await fetch(`${supersetUrl}/api/v1/chart/data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
      },
      credentials: 'include',
      body: JSON.stringify({
        ...queryContext,
        result_format: 'json',
        result_type: 'full'
      })
    });

    if (!dataResponse.ok) {
      throw new Error(`Failed to get chart data: ${dataResponse.status}`);
    }

    const data = await dataResponse.json();

    // Extract data from result
    if (data.result && data.result.length > 0 && data.result[0].data) {
      return data.result[0].data;
    } else {
      throw new Error('No data available in chart response');
    }
  } catch (error) {
    console.error('Error getting chart data:', error);
    throw error;
  }
}

// Export single chart data
async function exportSingleChartData(chartId, chartName, format) {
  showNotification(`Exporting ${chartName}...`, 'info');

  try {
    const chartData = await getChartData(chartId);

    if (format === 'csv') {
      const csv = convertToCSV(chartData);
      downloadFile(new Blob([csv], { type: 'text/csv' }), `${sanitizeFilename(chartName)}.csv`, 'text/csv');
    } else {
      const json = JSON.stringify(chartData, null, 2);
      downloadFile(new Blob([json], { type: 'application/json' }), `${sanitizeFilename(chartName)}.json`, 'application/json');
    }

    showNotification(`✅ ${chartName} exported as ${format.toUpperCase()}!`, 'success');
  } catch (error) {
    console.error('Error exporting chart:', error);
    showNotification(`❌ Export failed: ${error.message}`, 'error');
  }
}

// Export all charts data
async function exportAllChartsData(dashboardId, dashboardTitle, format) {
  showNotification('Exporting all charts...', 'info');

  try {
    const response = await fetch(`${supersetUrl}/api/v1/dashboard/${dashboardId}/charts`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to load charts: ${response.status}`);
    }

    const data = await response.json();
    const charts = data.result || [];

    let allData = [];

    for (const chart of charts) {
      try {
        const chartData = await getChartData(chart.id);
        allData.push({
          chart_name: chart.slice_name,
          chart_id: chart.id,
          data: chartData
        });
      } catch (error) {
        console.error(`Error loading chart ${chart.id}:`, error);
      }
    }

    if (format === 'csv') {
      const csv = convertChartsToCSV(allData);
      downloadFile(new Blob([csv], { type: 'text/csv' }), `${sanitizeFilename(dashboardTitle)}_all_charts.csv`, 'text/csv');
    } else {
      const json = JSON.stringify(allData, null, 2);
      downloadFile(new Blob([json], { type: 'application/json' }), `${sanitizeFilename(dashboardTitle)}_all_charts.json`, 'application/json');
    }

    showNotification(`✅ Exported ${charts.length} chart(s) as ${format.toUpperCase()}!`, 'success');
  } catch (error) {
    console.error('Error exporting all charts:', error);
    showNotification(`❌ Export failed: ${error.message}`, 'error');
  }
}

// Get Data Browsing (Dashboard Activity & Options) - MANTENER FUNCIÓN ORIGINAL
async function getDataBrowsing(dashboardId, dashboardTitle) {
  showInfoModal('Loading dashboard activity...', '');

  try {
    const response = await fetch(`${supersetUrl}/api/v1/dashboard/${dashboardId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to load dashboard data: ${response.status}`);
    }

    const data = await response.json();
    const dashboard = data.result;

    // Parse position_json to get layout changes
    let chartCount = 0;
    let layoutInfo = 'No layout data';

    try {
      const positionData = JSON.parse(dashboard.position_json);
      const chartIds = Object.keys(positionData).filter(key => key.startsWith('CHART-'));
      chartCount = chartIds.length;
      layoutInfo = `${chartCount} charts positioned`;
    } catch (e) {
      console.error('Error parsing position_json:', e);
    }

    // Parse json_metadata for additional info
    let filterCount = 0;
    let nativeFilters = 'None';

    try {
      const metadata = JSON.parse(dashboard.json_metadata);
      if (metadata.native_filter_configuration) {
        const filters = metadata.native_filter_configuration;
        filterCount = filters.length || 0;
        nativeFilters = filterCount > 0 ? `${filterCount} filter(s) configured` : 'None';
      }
    } catch (e) {
      console.error('Error parsing json_metadata:', e);
    }

    const createdDate = new Date(dashboard.changed_on).toLocaleString();
    const createdBy = dashboard.changed_by ?
      `${dashboard.changed_by.first_name} ${dashboard.changed_by.last_name}` : 'Unknown';

    // Build activity list
    const activityList = [];

    // Get user info (use changed_by as fallback if created_by not available)
    const modifiedBy = dashboard.changed_by ?
      `${dashboard.changed_by.first_name} ${dashboard.changed_by.last_name}` :
      (dashboard.changed_by_name || 'Unknown');

    const modifiedOn = dashboard.changed_on ?
      new Date(dashboard.changed_on).toLocaleString() : 'Unknown';

    // Only show creation if we have created_on data
    if (dashboard.created_on) {
      const createdByUser = dashboard.created_by ?
        `${dashboard.created_by.first_name} ${dashboard.created_by.last_name}` :
        modifiedBy; // Use modified_by as fallback
      const createdOnDate = new Date(dashboard.created_on).toLocaleString();

      activityList.push({
        action: '🆕 Dashboard Created',
        user: createdByUser,
        date: createdOnDate
      });
    }

    // Add modification event if different from creation
    if (dashboard.changed_on && (!dashboard.created_on || dashboard.changed_on !== dashboard.created_on)) {
      activityList.push({
        action: '✏️ Dashboard Modified',
        user: modifiedBy,
        date: modifiedOn
      });
    }

    // Add chart changes
    if (dashboard.charts && dashboard.charts.length > 0) {
      activityList.push({
        action: `📊 ${dashboard.charts.length} Chart(s) Added/Updated`,
        user: modifiedBy,
        date: modifiedOn
      });
    }

    // Add filter configuration
    if (filterCount > 0) {
      activityList.push({
        action: `🔍 ${filterCount} Filter(s) Configured`,
        user: modifiedBy,
        date: modifiedOn
      });
    }

    // Add publish status change
    if (dashboard.published) {
      activityList.push({
        action: '✅ Dashboard Published',
        user: modifiedBy,
        date: modifiedOn
      });
    }

    const activityHtml = activityList.map(activity => `
      <div class="activity-item">
        <div class="activity-action">${activity.action}</div>
        <div class="activity-meta">
          <span class="activity-user">👤 ${activity.user}</span>
          <span class="activity-date">🕒 ${activity.date}</span>
        </div>
      </div>
    `).join('');

    const browsingHtml = `
      <div class="data-browsing-container">
        <div class="browsing-section">
          <h3>📊 Dashboard Overview</h3>
          <div class="detail-row">
            <strong>Total Charts:</strong>
            <p>${dashboard.charts?.length || 0}</p>
          </div>
          <div class="detail-row">
            <strong>Layout:</strong>
            <p>${layoutInfo}</p>
          </div>
          <div class="detail-row">
            <strong>Native Filters:</strong>
            <p>${nativeFilters}</p>
          </div>
          <div class="detail-row">
            <strong>Published:</strong>
            <p>${dashboard.published ? '✅ Yes' : '❌ No'}</p>
          </div>
        </div>

        <div class="browsing-section">
          <h3>📈 Dashboard Metadata</h3>
          <div class="detail-row">
            <strong>Dashboard ID:</strong>
            <p>${dashboard.id}</p>
          </div>
          <div class="detail-row">
            <strong>Slug:</strong>
            <p>${dashboard.slug || 'N/A'}</p>
          </div>
          <div class="detail-row">
            <strong>Owners:</strong>
            <p>${dashboard.owners?.map(o => `${o.first_name} ${o.last_name}`).join(', ') || 'None'}</p>
          </div>
          <div class="detail-row">
            <strong>Tags:</strong>
            <p>${dashboard.tags?.map(t => `<span class="tag">${escapeHtml(t.name)}</span>`).join(' ') || 'No tags'}</p>
          </div>
        </div>

        <div class="browsing-section">
          <h3>🔄 Recent Activity</h3>
          <div class="activity-list">
            ${activityHtml}
          </div>
        </div>
      </div>
    `;

    showInfoModal(`Dashboard Metadata - ${dashboardTitle}`, browsingHtml);

  } catch (error) {
    console.error('Error loading data browsing:', error);
    showInfoModal('Error', `Failed to load dashboard data: ${error.message}`);
  }
}

async function exportDashboardConfig(dashboardId, dashboardTitle) {
  showExportModal('Exporting dashboard configuration...');

  try {
    // Export dashboard as ZIP (contains YAML configuration)
    const exportUrl = `${supersetUrl}/api/v1/dashboard/export/?q=!(${dashboardId})`;

    const response = await fetch(exportUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/zip'
      },
      credentials: 'include'
    });

    if (response.ok) {
      const blob = await response.blob();
      downloadFile(blob, `${sanitizeFilename(dashboardTitle)}_export.zip`, 'application/zip');
      hideExportModal();
      showNotification('✅ Dashboard config exported as ZIP!', 'success');
      return;
    }

    throw new Error(`Export failed: ${response.status}`);

  } catch (error) {
    console.error('Error exporting dashboard:', error);
    hideExportModal();
    showNotification('❌ Export failed: ' + error.message, 'error');
  }
}

// Enable inline title editing
function enableTitleEdit(titleElement, dashboardId, currentTitle) {
  const originalTitle = currentTitle;

  // Make element editable
  titleElement.contentEditable = 'true';
  titleElement.classList.add('editing');

  // Select all text
  const range = document.createRange();
  range.selectNodeContents(titleElement);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);

  // Focus the element
  titleElement.focus();

  // Handle save on blur or Enter key
  const saveEdit = async () => {
    const newTitle = titleElement.textContent.trim();

    if (!newTitle) {
      titleElement.textContent = originalTitle;
      titleElement.contentEditable = 'false';
      titleElement.classList.remove('editing');
      showNotification('❌ Dashboard name cannot be empty', 'error');
      return;
    }

    if (newTitle === originalTitle) {
      titleElement.contentEditable = 'false';
      titleElement.classList.remove('editing');
      return;
    }

    // Save the new title
    await performRename(dashboardId, newTitle);
    titleElement.contentEditable = 'false';
    titleElement.classList.remove('editing');
  };

  const cancelEdit = () => {
    titleElement.textContent = originalTitle;
    titleElement.contentEditable = 'false';
    titleElement.classList.remove('editing');
  };

  // Save on blur (when clicking outside)
  titleElement.addEventListener('blur', saveEdit, { once: true });

  // Save on Enter, cancel on Escape
  titleElement.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      titleElement.blur(); // This will trigger saveEdit
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  }, { once: true });
}

async function performRename(dashboardId, newTitle) {
  try {
    showNotification('Renaming dashboard...', 'info');

    // Get CSRF token
    const csrfToken = await getCSRFToken();

    // Update dashboard title via PUT request
    const response = await fetch(`${supersetUrl}/api/v1/dashboard/${dashboardId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
      },
      credentials: 'include',
      body: JSON.stringify({
        dashboard_title: newTitle
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `Status ${response.status}` }));
      throw new Error(errorData.message || `Failed to rename dashboard: ${response.status}`);
    }

    const data = await response.json();

    // Update the dashboard in our local array
    const dashboardIndex = dashboards.findIndex(d => d.id === dashboardId);
    if (dashboardIndex !== -1) {
      dashboards[dashboardIndex].dashboard_title = newTitle;
    }

    // Reload dashboards to refresh the UI
    await loadDashboards();

    hideInfoModal();
    showNotification('✅ Dashboard renamed successfully!', 'success');
  } catch (error) {
    console.error('Error renaming dashboard:', error);
    showNotification('❌ Failed to rename dashboard: ' + error.message, 'error');
  }
}

// Get Dashboard Permalink
async function getDashboardPermalink(dashboardId, dashboardTitle) {
  showInfoModal('Generating shareable link...', '');

  try {
    // First, get CSRF token
    const csrfToken = await getCSRFToken();

    // Try with minimal valid state
    const response = await fetch(`${supersetUrl}/api/v1/dashboard/${dashboardId}/permalink`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
      },
      credentials: 'include',
      body: JSON.stringify({
        dataMask: {},
        activeTabs: [],
        anchor: "",
        urlParams: []
      })
    });

    if (!response.ok) {
      let errorMessage = `Status ${response.status}`;
      try {
        const errorData = await response.json();
        console.error('Permalink API error response:', errorData);
        errorMessage = errorData.message || JSON.stringify(errorData);
      } catch (e) {
        const errorText = await response.text();
        console.error('Permalink API error text:', errorText);
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('Permalink response:', data);

    const permalinkKey = data.key;
    const fullUrl = `${supersetUrl}/superset/dashboard/p/${permalinkKey}/`;

    showInfoModal(
      `Shareable Link - ${dashboardTitle}`,
      `
        <div class="permalink-container">
          <p><strong>Share this link:</strong></p>
          <input type="text" value="${fullUrl}" readonly class="permalink-input" id="permalinkInput">
          <button id="copyPermalinkBtn" class="btn btn-primary">📋 Copy Link</button>
          <p class="permalink-note">This link will open the dashboard directly.</p>
        </div>
      `
    );

    // Add event listener to copy button after modal is shown
    setTimeout(() => {
      const copyBtn = document.getElementById('copyPermalinkBtn');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          const input = document.getElementById('permalinkInput');
          input.select();
          input.setSelectionRange(0, 99999); // For mobile devices
          document.execCommand('copy');
          showNotification('✅ Link copied to clipboard!', 'success');
        });
      }
    }, 100);
  } catch (error) {
    console.error('Error generating permalink:', error);
    showInfoModal('Error', `<p>Failed to generate permalink.</p><p style="font-size: 12px; color: #dc3545;">${escapeHtml(error.message)}</p>`);
  }
}

// Get Dashboard Details
async function getDashboardDetails(dashboardId) {
  showInfoModal('Loading dashboard details...', '');

  try {
    const response = await fetch(`${supersetUrl}/api/v1/dashboard/${dashboardId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to load details: ${response.status}`);
    }

    const data = await response.json();
    const dashboard = data.result;

    const createdDate = new Date(dashboard.created_on).toLocaleDateString();
    const modifiedDate = new Date(dashboard.changed_on).toLocaleDateString();
    const ownerNames = dashboard.owners?.map(o => o.username || o.first_name).join(', ') || 'Unknown';
    const tagsHtml = dashboard.tags?.length > 0
      ? dashboard.tags.map(t => `<span class="tag">${escapeHtml(t.name)}</span>`).join(' ')
      : 'No tags';

    showInfoModal(
      `Dashboard Details - ${dashboard.dashboard_title}`,
      `
        <div class="details-container">
          <div class="detail-row">
            <strong>Description:</strong>
            <p>${escapeHtml(dashboard.description) || 'No description'}</p>
          </div>
          <div class="detail-row">
            <strong>Owner:</strong>
            <p>${escapeHtml(ownerNames)}</p>
          </div>
          <div class="detail-row">
            <strong>Created:</strong>
            <p>${createdDate}</p>
          </div>
          <div class="detail-row">
            <strong>Last Modified:</strong>
            <p>${modifiedDate}</p>
          </div>
          <div class="detail-row">
            <strong>Tags:</strong>
            <p>${tagsHtml}</p>
          </div>
          <div class="detail-row">
            <strong>Number of Charts:</strong>
            <p>${dashboard.slices?.length || 0}</p>
          </div>
          <div class="detail-row">
            <strong>Published:</strong>
            <p>${dashboard.published ? '✅ Yes' : '❌ No'}</p>
          </div>
        </div>
      `
    );
  } catch (error) {
    console.error('Error loading details:', error);
    showInfoModal('Error', `Failed to load details: ${error.message}`);
  }
}

// Get Dashboard Charts
async function getDashboardCharts(dashboardId, dashboardTitle) {
  showInfoModal('Loading charts...', '');

  try {
    const response = await fetch(`${supersetUrl}/api/v1/dashboard/${dashboardId}/charts`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to load charts: ${response.status}`);
    }

    const data = await response.json();
    const charts = data.result;

    if (charts.length === 0) {
      showInfoModal(`Charts - ${dashboardTitle}`, '<p>No charts found in this dashboard.</p>');
      return;
    }

    const chartsHtml = `
      <div class="charts-container">
        <p><strong>Total Charts:</strong> ${charts.length}</p>
        <table class="charts-table">
          <thead>
            <tr>
              <th>Chart Name</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${charts.map(chart => `
              <tr>
                <td>${escapeHtml(chart.slice_name)}</td>
                <td>
                  <button class="btn btn-sm btn-primary export-chart-btn"
                          data-chart-id="${chart.id}"
                          data-chart-name="${escapeHtml(chart.slice_name)}">
                    📥 Export CSV
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    showInfoModal(`Charts - ${dashboardTitle}`, chartsHtml);

    // Add event listeners to all export buttons after modal is shown
    setTimeout(() => {
      const exportButtons = document.querySelectorAll('.export-chart-btn');
      exportButtons.forEach(button => {
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          const chartId = button.getAttribute('data-chart-id');
          const chartName = button.getAttribute('data-chart-name');
          exportChartData(chartId, chartName);
        });
      });
    }, 100);
  } catch (error) {
    console.error('Error loading charts:', error);
    showInfoModal('Error', `Failed to load charts: ${error.message}`);
  }
}

// Export Chart Data
async function exportChartData(chartId, chartName) {
  try {
    showNotification('Exporting chart data...', 'info');

    // First, get the chart details to get the query_context
    const chartResponse = await fetch(`${supersetUrl}/api/v1/chart/${chartId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      credentials: 'include'
    });

    if (!chartResponse.ok) {
      throw new Error(`Failed to get chart details: ${chartResponse.status}`);
    }

    const chartData = await chartResponse.json();
    const chart = chartData.result;

    // Check if chart has query_context
    if (!chart.query_context) {
      showNotification('⚠️ This chart has no saved query. Cannot export data.', 'error');
      return;
    }

    // Parse query_context
    const queryContext = JSON.parse(chart.query_context);

    // Get CSRF token for POST request
    const csrfToken = await getCSRFToken();

    // Use POST /data endpoint with the query context
    const dataResponse = await fetch(`${supersetUrl}/api/v1/chart/data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
      },
      credentials: 'include',
      body: JSON.stringify({
        ...queryContext,
        result_format: 'csv',
        result_type: 'full'
      })
    });

    if (!dataResponse.ok) {
      throw new Error(`Failed to export chart data: ${dataResponse.status}`);
    }

    // Check if response is CSV
    const contentType = dataResponse.headers.get('content-type');
    if (contentType && (contentType.includes('text/csv') || contentType.includes('application/csv'))) {
      // Direct CSV download
      const blob = await dataResponse.blob();
      downloadFile(blob, `${sanitizeFilename(chartName)}.csv`, 'text/csv');
    } else {
      // JSON response - convert to CSV
      const data = await dataResponse.json();

      // Extract data from result
      if (data.result && data.result.length > 0 && data.result[0].data) {
        const csv = convertToCSV(data.result[0]);
        const blob = new Blob([csv], { type: 'text/csv' });
        downloadFile(blob, `${sanitizeFilename(chartName)}.csv`, 'text/csv');
      } else {
        throw new Error('No data available in chart response');
      }
    }

    showNotification('✅ Chart data exported!', 'success');
  } catch (error) {
    console.error('Error exporting chart:', error);
    showNotification('❌ Export failed: ' + error.message, 'error');
  }
}

function convertToCSV(data) {
  // Handle different Superset API response formats

  if (!data) {
    return 'No data available';
  }

  // Try different data paths
  let records = null;

  if (data.result && Array.isArray(data.result)) {
    // Format 1: { result: [{...}, {...}] }
    records = data.result;
  } else if (data.result && data.result.data && Array.isArray(data.result.data)) {
    // Format 2: { result: { data: [{...}, {...}] } }
    records = data.result.data;
  } else if (data.result && data.result[0] && data.result[0].data) {
    // Format 3: { result: [{ data: [{...}, {...}] }] }
    records = data.result[0].data;
  } else if (data.data && Array.isArray(data.data)) {
    // Format 4: { data: [{...}, {...}] }
    records = data.data;
  }

  if (!records || !Array.isArray(records) || records.length === 0) {
    console.log('Could not find data in response:', data);
    return 'No data available in this chart';
  }

  // Get headers from first record
  const headers = Object.keys(records[0]);

  if (headers.length === 0) {
    return 'No columns found in data';
  }

  // Create CSV
  const csvRows = [];
  csvRows.push(headers.join(','));

  records.forEach(record => {
    const values = headers.map(header => {
      const value = record[header];
      // Handle null/undefined
      if (value === null || value === undefined) {
        return '""';
      }
      // Escape commas and quotes
      const escaped = String(value).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  });

  return csvRows.join('\n');
}

function convertChartsToCSV(chartsData) {
  // Convert multiple charts data to CSV format
  // Format: Chart Name, Chart ID, then all data columns

  if (!chartsData || chartsData.length === 0) {
    return 'No data available';
  }

  let csvOutput = '';

  for (const chartInfo of chartsData) {
    const chartName = chartInfo.chart_name || 'Unknown Chart';
    const chartId = chartInfo.chart_id || 'N/A';
    const data = chartInfo.data;

    // Add chart header
    csvOutput += `\n\n=== ${chartName} (ID: ${chartId}) ===\n`;

    if (!data || !Array.isArray(data) || data.length === 0) {
      csvOutput += 'No data available\n';
      continue;
    }

    // Get headers from first record
    const headers = Object.keys(data[0]);

    if (headers.length === 0) {
      csvOutput += 'No columns found\n';
      continue;
    }

    // Add CSV headers
    csvOutput += headers.join(',') + '\n';

    // Add data rows
    data.forEach(record => {
      const values = headers.map(header => {
        const value = record[header];
        if (value === null || value === undefined) {
          return '""';
        }
        const escaped = String(value).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvOutput += values.join(',') + '\n';
    });
  }

  return csvOutput;
}

function openDashboard(dashboardId) {
  const dashboardUrl = `${supersetUrl}/superset/dashboard/${dashboardId}/`;
  chrome.tabs.create({ url: dashboardUrl });
  showNotification('Opening dashboard in new tab...', 'info');
}

function downloadFile(blob, filename, mimeType) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function filterDashboards(event) {
  const searchTerm = event.target.value.toLowerCase();

  const filtered = dashboards.filter(dashboard => {
    const title = (dashboard.dashboard_title || '').toLowerCase();
    const owners = (dashboard.owners || [])
      .map(o => (o.username || o.first_name || '').toLowerCase())
      .join(' ');

    return title.includes(searchTerm) || owners.includes(searchTerm);
  });

  displayDashboards(filtered);
}

async function logout() {
  if (confirm('Are you sure you want to logout?')) {
    // Check if user wants to remember password
    const data = await chrome.storage.local.get(['rememberPassword']);
    const shouldRemember = data.rememberPassword !== false;

    if (shouldRemember) {
      // Only clear access token, keep credentials
      await chrome.storage.local.remove(['accessToken']);
    } else {
      // Clear everything including credentials
      await chrome.storage.local.remove(['accessToken', 'username', 'password', 'rememberPassword']);
    }

    showNotification('Logged out successfully', 'success');
    setTimeout(() => {
      window.location.href = 'popup.html';
    }, 1000);
  }
}

// UI Helper Functions
function showLoading(show) {
  document.getElementById('loadingIndicator').style.display = show ? 'block' : 'none';
}

function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  document.getElementById('errorText').textContent = message;
  errorDiv.style.display = 'flex';
}

function hideError() {
  document.getElementById('errorMessage').style.display = 'none';
}

function showEmptyState() {
  document.getElementById('emptyState').style.display = 'block';
  document.getElementById('dashboardsContainer').style.display = 'none';
}

function hideEmptyState() {
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('dashboardsContainer').style.display = 'flex';
}

function showExportModal(message) {
  document.getElementById('exportStatus').textContent = message;
  document.getElementById('exportModal').style.display = 'flex';
}

function hideExportModal() {
  document.getElementById('exportModal').style.display = 'none';
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 4000);
}

// Info Modal Functions
function showInfoModal(title, content) {
  const modal = document.getElementById('infoModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');

  modalTitle.textContent = title;
  modalBody.innerHTML = content;
  modal.style.display = 'flex';
}

function hideInfoModal() {
  const modal = document.getElementById('infoModal');
  modal.style.display = 'none';
}

// Setup modal close handlers
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.querySelector('.close');
  if (closeBtn) {
    closeBtn.addEventListener('click', hideInfoModal);
  }

  window.addEventListener('click', (event) => {
    const modal = document.getElementById('infoModal');
    if (event.target === modal) {
      hideInfoModal();
    }
  });
});

// Get CSRF Token
async function getCSRFToken() {
  try {
    const response = await fetch(`${supersetUrl}/api/v1/security/csrf_token/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      return data.result;
    }

    // Fallback: try to get from cookie
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'csrf_access_token' || name === 'csrf_token') {
        return value;
      }
    }

    throw new Error('Could not get CSRF token');
  } catch (error) {
    console.error('Error getting CSRF token:', error);
    throw error;
  }
}

async function deleteDashboard(dashboardId, dashboardTitle) {
  // Confirm deletion
  if (!confirm(`Are you sure you want to delete "${dashboardTitle}"?\n\nThis action cannot be undone.`)) {
    return;
  }

  showNotification('Deleting dashboard...', 'info');

  try {
    const csrfToken = await getCSRFToken();
    const response = await fetch(`${supersetUrl}/api/v1/dashboard/${dashboardId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-CSRFToken': csrfToken
      },
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to delete dashboard: ${response.status}`);
    }

    // Remove dashboard from local array
    const index = dashboards.findIndex(d => d.id === dashboardId);
    if (index !== -1) {
      dashboards.splice(index, 1);
    }

    // Refresh the display
    displayDashboards(dashboards);
    showNotification(`✅ Dashboard "${dashboardTitle}" deleted successfully!`, 'success');
  } catch (error) {
    console.error('Error deleting dashboard:', error);
    showNotification(`❌ Delete failed: ${error.message}`, 'error');
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function sanitizeFilename(filename) {
  return filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}
