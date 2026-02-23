if (window.location.pathname.includes('/login') || isLoginPage()) {
  initAutoLogin();
}

function isLoginPage() {
  return document.querySelector('input[name="username"]') !== null ||
         document.querySelector('input[type="text"][placeholder*="username" i]') !== null ||
         document.querySelector('form[action*="login"]') !== null;
}

async function initAutoLogin() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', performAutoLogin);
  } else {
    performAutoLogin();
  }
}

async function performAutoLogin() {
  try {
    const data = await chrome.storage.local.get(['username', 'password', 'supersetUrl']);

    if (!data.username || !data.password) return;

    await sleep(1000);

    const loginSuccess = await performAPILogin(data.username, atob(data.password), data.supersetUrl);
    if (loginSuccess) {
      await sleep(1000);
      window.location.href = chrome.runtime.getURL('dashboard-list.html');
      return;
    }

    const filled = await fillLoginForm(data.username, atob(data.password));
    if (filled) {
      await sleep(500);
      const submitted = submitLoginForm();
      if (submitted) {
        await sleep(2000);
        window.location.href = chrome.runtime.getURL('dashboard-list.html');
      }
    }
  } catch (error) {
    console.error('Auto-login error:', error);
  }
}

async function performAPILogin(username, password, supersetUrl) {
  try {
    const response = await fetch(`${supersetUrl}/api/v1/security/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, provider: 'db', refresh: true })
    });

    if (response.ok) {
      const result = await response.json();
      if (result.access_token) {
        await chrome.storage.local.set({ accessToken: result.access_token, username });
        chrome.runtime.sendMessage({ action: 'loginSuccess' });
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('API login failed:', error);
    return false;
  }
}

async function fillLoginForm(username, password) {
  const usernameSelectors = [
    'input[name="username"]',
    'input[id="username"]',
    'input[type="text"]',
    'input[placeholder*="username" i]',
    'input[placeholder*="user" i]'
  ];
  const passwordSelectors = [
    'input[name="password"]',
    'input[id="password"]',
    'input[type="password"]'
  ];

  let usernameField = usernameSelectors.map(s => document.querySelector(s)).find(el => el);
  let passwordField = passwordSelectors.map(s => document.querySelector(s)).find(el => el);

  if (!usernameField || !passwordField) return false;

  setInputValue(usernameField, username);
  setInputValue(passwordField, password);
  return true;
}

function setInputValue(input, value) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  ).set;

  nativeInputValueSetter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));
}

function submitLoginForm() {
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
      button.click();
      return true;
    }
  }

  const form = document.querySelector('form');
  if (form) {
    form.submit();
    return true;
  }

  return false;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'login') {
    performAutoLogin();
    sendResponse({ success: true });
  }
  return true;
});

function addLoginIndicator() {
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
