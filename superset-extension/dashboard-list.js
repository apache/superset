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
}

async function loadUserData() {
  try {
    const data = await chrome.storage.local.get(['accessToken', 'supersetUrl', 'username']);

    if (!data.accessToken || !data.supersetUrl) {
      showError('Not logged in. Please login first.');
      setTimeout(() => {
        window.location.href = 'popup.html';
      }, 2000);
      return;
    }

    accessToken = data.accessToken;
    supersetUrl = data.supersetUrl;
    username = data.username || 'User';

    document.getElementById('welcomeMessage').textContent = `Welcome, ${username}! 👋`;
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

  card.innerHTML = `
    <div class="dashboard-header">
      <div class="dashboard-icon">📊</div>
      <div class="dashboard-info">
        <div class="dashboard-title">${escapeHtml(dashboard.dashboard_title || 'Untitled Dashboard')}</div>
        <div class="dashboard-meta">
          <span>👤 ${escapeHtml(owners)}</span>
          <span>🕒 Modified ${escapeHtml(modifiedDate)}</span>
        </div>
      </div>
    </div>
    <div class="dashboard-actions">
      <button class="btn btn-info get-permalink-btn" data-dashboard-id="${dashboard.id}" data-dashboard-title="${escapeHtml(dashboard.dashboard_title)}">
        🔗 Get Link
      </button>
      <button class="btn btn-info view-details-btn" data-dashboard-id="${dashboard.id}">
        ℹ️ Details
      </button>
      <button class="btn btn-info view-charts-btn" data-dashboard-id="${dashboard.id}" data-dashboard-title="${escapeHtml(dashboard.dashboard_title)}">
        📊 Charts
      </button>
    </div>
    <div class="dashboard-actions" style="margin-top: 10px;">
      <button class="btn btn-info data-browsing-btn" data-dashboard-id="${dashboard.id}" data-dashboard-title="${escapeHtml(dashboard.dashboard_title)}">
        📋 Data Browsing
      </button>
      <button class="btn btn-success export-config-btn" data-dashboard-id="${dashboard.id}" data-dashboard-title="${escapeHtml(dashboard.dashboard_title)}">
        📦 Export Config
      </button>
      <button class="btn btn-secondary open-dashboard-btn" data-dashboard-id="${dashboard.id}">
        🔗 Open
      </button>
    </div>
  `;

  // Add event listeners to buttons
  const permalinkBtn = card.querySelector('.get-permalink-btn');
  const detailsBtn = card.querySelector('.view-details-btn');
  const chartsBtn = card.querySelector('.view-charts-btn');
  const dataBrowsingBtn = card.querySelector('.data-browsing-btn');
  const configBtn = card.querySelector('.export-config-btn');
  const openBtn = card.querySelector('.open-dashboard-btn');

  permalinkBtn.addEventListener('click', () => {
    getDashboardPermalink(dashboard.id, dashboard.dashboard_title);
  });

  detailsBtn.addEventListener('click', () => {
    getDashboardDetails(dashboard.id);
  });

  chartsBtn.addEventListener('click', () => {
    getDashboardCharts(dashboard.id, dashboard.dashboard_title);
  });

  dataBrowsingBtn.addEventListener('click', () => {
    getDataBrowsing(dashboard.id, dashboard.dashboard_title);
  });

  configBtn.addEventListener('click', () => {
    exportDashboardConfig(dashboard.id, dashboard.dashboard_title);
  });

  openBtn.addEventListener('click', () => {
    openDashboard(dashboard.id);
  });

  return card;
}

// Get Data Browsing (Dashboard Activity & Options)
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

    showInfoModal(`Data Browsing - ${dashboardTitle}`, browsingHtml);

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
    await chrome.storage.local.remove(['accessToken', 'username']);
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
  document.getElementById('dashboardsContainer').style.display = 'grid';
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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function sanitizeFilename(filename) {
  return filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}
