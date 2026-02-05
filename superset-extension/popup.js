// Load saved credentials when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  await loadCredentials();
  updateStatus();
  
  // Check if already logged in, redirect to dashboards
  const data = await chrome.storage.local.get(['accessToken', 'username', 'password']);
  if (data.accessToken && data.username && data.password) {
    // Already logged in, go directly to dashboards
    window.location.href = 'dashboard-list.html';
  }
});

// Save credentials and login
document.getElementById('credentialsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveAndLogin();
});

// Clear credentials
document.getElementById('clearCredentials').addEventListener('click', async () => {
  if (confirm('Are you sure you want to clear all saved credentials?')) {
    await clearCredentials();
  }
});

async function loadCredentials() {
  const data = await chrome.storage.local.get(['username', 'password', 'rememberPassword']);

  // Load credentials if rememberPassword is not explicitly false (default is true)
  const shouldRemember = data.rememberPassword !== false;
  
  if (shouldRemember) {
    if (data.username) {
      document.getElementById('username').value = data.username;
    }
    if (data.password) {
      document.getElementById('password').value = atob(data.password); // Decode from base64
    }
  }
  
  // Set checkbox state (default checked)
  document.getElementById('rememberPassword').checked = shouldRemember;
}

async function saveAndLogin() {
  // Get URL from manifest
  const manifest = chrome.runtime.getManifest();
  const supersetUrl = manifest.superset_url || 'http://localhost:8088';
  
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const rememberPassword = document.getElementById('rememberPassword').checked;

  if (!username || !password) {
    showNotification('Please fill in all fields', 'error');
    return;
  }

  // Save to storage only if rememberPassword is checked
  if (rememberPassword) {
    await chrome.storage.local.set({
      supersetUrl,
      username,
      password: btoa(password), // Encode to base64
      rememberPassword: true
    });
  } else {
    // Don't save credentials, only save the preference
    await chrome.storage.local.set({
      supersetUrl,
      rememberPassword: false
    });
    // Clear any previously saved credentials
    await chrome.storage.local.remove(['username', 'password']);
  }

  showNotification('Logging in...', 'info');

  // Attempt login
  try {
    const response = await fetch(`${supersetUrl}/api/v1/security/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username,
        password: password,
        provider: 'db',
        refresh: true
      })
    });

    if (response.ok) {
      const result = await response.json();

      // Store access token
      if (result.access_token) {
        await chrome.storage.local.set({
          accessToken: result.access_token
        });

        showNotification('✅ Login successful! Loading dashboards...', 'success');
        
        // Navigate to dashboard list after a short delay
        setTimeout(() => {
          window.location.href = 'dashboard-list.html';
        }, 500);
      }
    } else {
      const error = await response.text();
      showNotification('❌ Login failed: Invalid credentials', 'error');
    }
  } catch (error) {
    showNotification('❌ Connection error: ' + error.message, 'error');
  }
}

async function clearCredentials() {
  await chrome.storage.local.clear();
  document.getElementById('credentialsForm').reset();
  document.getElementById('rememberPassword').checked = true;
  showNotification('All data cleared', 'info');
  updateStatus();
}

async function updateStatus() {
  const data = await chrome.storage.local.get(['username', 'password', 'rememberPassword']);
  const indicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');

  if (data.username && data.password && data.rememberPassword) {
    indicator.className = 'status-indicator active';
    statusText.textContent = 'Credentials saved';
  } else {
    indicator.className = 'status-indicator inactive';
    statusText.textContent = 'Not configured';
  }
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}
