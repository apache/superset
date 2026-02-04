// Load saved credentials when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  await loadCredentials();
  updateStatus();
});

// Save credentials
document.getElementById('credentialsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveCredentials();
});

// Test login
document.getElementById('testLogin').addEventListener('click', async () => {
  await testLogin();
});

// Clear credentials
document.getElementById('clearCredentials').addEventListener('click', async () => {
  if (confirm('Are you sure you want to clear all saved credentials?')) {
    await clearCredentials();
  }
});

// Login now
document.getElementById('loginNow').addEventListener('click', async () => {
  await loginNow();
});

async function loadCredentials() {
  const data = await chrome.storage.local.get(['supersetUrl', 'username', 'password', 'autoLogin']);

  if (data.supersetUrl) {
    document.getElementById('supersetUrl').value = data.supersetUrl;
  }
  if (data.username) {
    document.getElementById('username').value = data.username;
  }
  if (data.password) {
    document.getElementById('password').value = atob(data.password); // Decode from base64
  }
  if (data.autoLogin !== undefined) {
    document.getElementById('autoLogin').checked = data.autoLogin;
  }
}

async function saveCredentials() {
  const supersetUrl = document.getElementById('supersetUrl').value.trim();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const autoLogin = document.getElementById('autoLogin').checked;

  if (!supersetUrl || !username || !password) {
    showNotification('Please fill in all fields', 'error');
    return;
  }

  // Validate URL
  try {
    new URL(supersetUrl);
  } catch (e) {
    showNotification('Invalid URL format', 'error');
    return;
  }

  // Save to storage (password encoded in base64 - basic obfuscation)
  await chrome.storage.local.set({
    supersetUrl,
    username,
    password: btoa(password), // Encode to base64
    autoLogin
  });

  showNotification('Credentials saved successfully!', 'success');
  updateStatus();
}

async function clearCredentials() {
  await chrome.storage.local.clear();
  document.getElementById('credentialsForm').reset();
  document.getElementById('supersetUrl').value = 'http://localhost:8088';
  document.getElementById('autoLogin').checked = true;
  showNotification('All data cleared', 'info');
  updateStatus();
}

async function testLogin() {
  const data = await chrome.storage.local.get(['supersetUrl', 'username', 'password']);

  if (!data.username || !data.password) {
    showNotification('Please save credentials first', 'error');
    return;
  }

  showNotification('Testing login...', 'info');

  try {
    const response = await fetch(`${data.supersetUrl}/api/v1/security/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: data.username,
        password: atob(data.password),
        provider: 'db',
        refresh: true
      })
    });

    if (response.ok) {
      const result = await response.json();

      // Store access token for dashboard list
      if (result.access_token) {
        await chrome.storage.local.set({
          accessToken: result.access_token
        });
      }

      showNotification('✅ Login test successful!', 'success');
    } else {
      const error = await response.text();
      showNotification('❌ Login failed: Invalid credentials', 'error');
    }
  } catch (error) {
    showNotification('❌ Connection error: ' + error.message, 'error');
  }
}

async function loginNow() {
  const data = await chrome.storage.local.get(['supersetUrl', 'username', 'password', 'accessToken']);

  if (!data.supersetUrl) {
    showNotification('Please configure Superset URL first', 'error');
    return;
  }

  if (!data.username || !data.password) {
    showNotification('Please save credentials first', 'error');
    return;
  }

  // If we already have a token, go directly to dashboard list
  if (data.accessToken) {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard-list.html') });
    showNotification('Opening dashboard list...', 'info');
    window.close();
    return;
  }

  // Otherwise, perform login first
  showNotification('Logging in...', 'info');

  try {
    const response = await fetch(`${data.supersetUrl}/api/v1/security/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: data.username,
        password: atob(data.password),
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

        // Open dashboard list
        chrome.tabs.create({ url: chrome.runtime.getURL('dashboard-list.html') });
        showNotification('Login successful! Opening dashboards...', 'success');
      }
    } else {
      showNotification('Login failed. Please check credentials.', 'error');
    }
  } catch (error) {
    showNotification('Connection error: ' + error.message, 'error');
  }

  window.close();
}

async function updateStatus() {
  const data = await chrome.storage.local.get(['username', 'password', 'autoLogin']);
  const indicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');

  if (data.username && data.password) {
    if (data.autoLogin) {
      indicator.className = 'status-indicator active';
      statusText.textContent = 'Auto-login enabled';
    } else {
      indicator.className = 'status-indicator warning';
      statusText.textContent = 'Auto-login disabled';
    }
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
