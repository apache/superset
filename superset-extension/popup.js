// Utility: Sleep helper
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  await loadCredentials();
  updateStatus();

  // Redirect if already logged in
  const { accessToken, username, password } = await chrome.storage.local.get(
    ['accessToken', 'username', 'password']
  );
  if (accessToken && username && password) {
    window.location.href = 'dashboard-list.html';
  }
});

// Event listeners
document.getElementById('credentialsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveAndLogin();
});

document.getElementById('clearCredentials').addEventListener('click', async () => {
  if (confirm('Are you sure you want to clear all saved credentials?')) {
    await clearCredentials();
  }
});

async function loadCredentials() {
  const data = await chrome.storage.local.get([
    'supersetUrl',
    'username',
    'password',
    'rememberPassword'
  ]);

  if (data.supersetUrl) {
    document.getElementById('supersetUrl').value = data.supersetUrl;
  }

  const shouldRemember = data.rememberPassword !== false;

  if (shouldRemember && data.username) {
    document.getElementById('username').value = data.username;
  }
  if (shouldRemember && data.password) {
    document.getElementById('password').value = atob(data.password);
  }

  document.getElementById('rememberPassword').checked = shouldRemember;
}

async function saveAndLogin() {
  let supersetUrl = document.getElementById('supersetUrl').value.trim();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const rememberPassword = document.getElementById('rememberPassword').checked;

  if (!supersetUrl || !username || !password) {
    showNotification('Please fill in all fields', 'error');
    return;
  }

  // Normalize URL
  if (supersetUrl.endsWith('/')) {
    supersetUrl = supersetUrl.slice(0, -1);
  }

  // Validate URL format
  try {
    new URL(supersetUrl);
  } catch {
    showNotification('❌ Invalid URL format', 'error');
    return;
  }

  // Save credentials
  if (rememberPassword) {
    await chrome.storage.local.set({
      supersetUrl,
      username,
      password: btoa(password),
      rememberPassword: true
    });
  } else {
    await chrome.storage.local.set({ supersetUrl, rememberPassword: false });
    await chrome.storage.local.remove(['username', 'password']);
  }

  showNotification('Logging in...', 'info');

  // Attempt login
  try {
    const response = await fetch(`${supersetUrl}/api/v1/security/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        provider: 'db',
        refresh: true
      })
    });

    if (response.ok) {
      const result = await response.json();

      if (result.access_token) {
        await chrome.storage.local.set({ accessToken: result.access_token });
        showNotification('✅ Login successful! Loading dashboards...', 'success');

        setTimeout(() => {
          window.location.href = 'dashboard-list.html';
        }, 500);
      }
    } else {
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
  const { username, password, rememberPassword } = await chrome.storage.local.get(
    ['username', 'password', 'rememberPassword']
  );
  const indicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');

  if (username && password && rememberPassword) {
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

  setTimeout(() => notification.remove(), 3000);
}
