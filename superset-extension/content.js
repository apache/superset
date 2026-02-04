// Content script that runs on Superset pages
console.log('Superset Auto Login: Content script loaded');

// Check if we're on the login page
if (window.location.pathname.includes('/login') || isLoginPage()) {
  console.log('Superset Auto Login: Login page detected');
  initAutoLogin();
}

function isLoginPage() {
  // Check for login form elements
  return document.querySelector('input[name="username"]') !== null ||
         document.querySelector('input[type="text"][placeholder*="username" i]') !== null ||
         document.querySelector('form[action*="login"]') !== null;
}

async function initAutoLogin() {
  // Wait for page to fully load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', performAutoLogin);
  } else {
    performAutoLogin();
  }
}

async function performAutoLogin() {
  try {
    const data = await chrome.storage.local.get(['username', 'password', 'autoLogin', 'supersetUrl']);

    if (!data.autoLogin) {
      console.log('Superset Auto Login: Auto-login is disabled');
      return;
    }

    if (!data.username || !data.password) {
      console.log('Superset Auto Login: No credentials saved');
      return;
    }

    // Wait a bit for the form to be fully rendered
    await sleep(1000);

    // Try API login first to get JWT token
    const loginSuccess = await performAPILogin(data.username, atob(data.password), data.supersetUrl);

    if (loginSuccess) {
      console.log('Superset Auto Login: API login successful, redirecting to dashboard list...');
      // Redirect to extension's dashboard list page
      await sleep(1000);
      window.location.href = chrome.runtime.getURL('dashboard-list.html');
      return;
    }

    // Fallback to form-based login
    const filled = await fillLoginForm(data.username, atob(data.password));

    if (filled) {
      console.log('Superset Auto Login: Form filled, submitting...');
      await sleep(500);
      const submitted = submitLoginForm();

      if (submitted) {
        // Wait for login to complete, then redirect
        await sleep(2000);
        window.location.href = chrome.runtime.getURL('dashboard-list.html');
      }
    } else {
      console.log('Superset Auto Login: Could not find login form');
    }
  } catch (error) {
    console.error('Superset Auto Login: Error during auto-login:', error);
  }
}

async function performAPILogin(username, password, supersetUrl) {
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

      // Store access token and username
      if (result.access_token) {
        await chrome.storage.local.set({
          accessToken: result.access_token,
          username: username
        });

        console.log('Superset Auto Login: Access token stored');
        chrome.runtime.sendMessage({ action: 'loginSuccess' });
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Superset Auto Login: API login failed:', error);
    return false;
  }
}

async function fillLoginForm(username, password) {
  // Try different selectors for username field
  const usernameSelectors = [
    'input[name="username"]',
    'input[id="username"]',
    'input[type="text"]',
    'input[placeholder*="username" i]',
    'input[placeholder*="user" i]'
  ];

  // Try different selectors for password field
  const passwordSelectors = [
    'input[name="password"]',
    'input[id="password"]',
    'input[type="password"]'
  ];

  let usernameField = null;
  let passwordField = null;

  // Find username field
  for (const selector of usernameSelectors) {
    usernameField = document.querySelector(selector);
    if (usernameField) break;
  }

  // Find password field
  for (const selector of passwordSelectors) {
    passwordField = document.querySelector(selector);
    if (passwordField) break;
  }

  if (!usernameField || !passwordField) {
    return false;
  }

  // Fill the fields
  setInputValue(usernameField, username);
  setInputValue(passwordField, password);

  return true;
}

function setInputValue(input, value) {
  // Set value using multiple methods to trigger React/Vue events
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  ).set;

  nativeInputValueSetter.call(input, value);

  // Trigger events
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));
}

function submitLoginForm() {
  // Try to find and click the submit button
  const submitSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:contains("Sign In")',
    'button:contains("Login")',
    'button:contains("Log in")',
    '.btn-primary',
    '[data-test="login-button"]'
  ];

  for (const selector of submitSelectors) {
    const button = document.querySelector(selector);
    if (button) {
      console.log('Superset Auto Login: Clicking submit button');
      button.click();
      return true;
    }
  }

  // If no button found, try to submit the form directly
  const form = document.querySelector('form');
  if (form) {
    console.log('Superset Auto Login: Submitting form directly');
    form.submit();
    return true;
  }

  console.log('Superset Auto Login: Could not find submit button or form');
  return false;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'login') {
    performAutoLogin();
    sendResponse({ success: true });
  }
  return true;
});

// Add visual indicator when auto-login is active
function showAutoLoginIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'superset-autologin-indicator';
  indicator.innerHTML = '🔐 Auto-login active';
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: fadeIn 0.3s ease;
  `;

  document.body.appendChild(indicator);

  setTimeout(() => {
    indicator.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => indicator.remove(), 300);
  }, 3000);
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeOut {
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(-20px); }
  }
`;
document.head.appendChild(style);
