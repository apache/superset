// Background service worker for the extension

console.log('Superset Auto Login: Background service worker started');

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Superset Auto Login: Extension installed/updated');

  if (details.reason === 'install') {
    console.log('Superset Auto Login: First install');
    // Open popup on first install
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
  } else if (details.reason === 'update') {
    console.log('Superset Auto Login: Extension updated');
  }

  // Create context menus
  try {
    chrome.contextMenus.create({
      id: 'openSuperset',
      title: 'Open Superset',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      id: 'loginToSuperset',
      title: 'Login to Superset',
      contexts: ['all']
    });
    console.log('Superset Auto Login: Context menus created');
  } catch (error) {
    console.error('Superset Auto Login: Error creating context menus:', error);
  }
});

// Listen for tab updates to detect Superset login page
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      const data = await chrome.storage.local.get(['supersetUrl']);

      if (data.supersetUrl) {
        const supersetHost = new URL(data.supersetUrl).hostname;

        // Check if the tab is on Superset login page
        if (tab.url.includes(supersetHost) && tab.url.includes('/login')) {
          console.log('Superset Auto Login: Login page detected in tab', tabId);

          // Badge to show extension is active
          chrome.action.setBadgeText({ text: '●', tabId });
          chrome.action.setBadgeBackgroundColor({ color: '#28a745', tabId });
        }
      }
    } catch (error) {
      console.error('Superset Auto Login: Error in tab update listener:', error);
    }
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'loginSuccess') {
    console.log('Superset Auto Login: Login successful');
    // Clear badge
    if (sender.tab) {
      chrome.action.setBadgeText({ text: '', tabId: sender.tab.id });
    }
    sendResponse({ success: true });
  } else if (request.action === 'loginFailed') {
    console.log('Superset Auto Login: Login failed');
    // Show error badge
    if (sender.tab) {
      chrome.action.setBadgeText({ text: '!', tabId: sender.tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#dc3545', tabId: sender.tab.id });
    }
    sendResponse({ success: false });
  }
  return true;
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    const data = await chrome.storage.local.get(['supersetUrl']);

    if (info.menuItemId === 'openSuperset') {
      if (!data.supersetUrl) {
        console.log('Superset Auto Login: No Superset URL configured');
        return;
      }
      chrome.tabs.create({ url: data.supersetUrl });
    } else if (info.menuItemId === 'loginToSuperset') {
      if (!data.supersetUrl) {
        console.log('Superset Auto Login: No Superset URL configured');
        return;
      }
      chrome.tabs.create({ url: data.supersetUrl + '/login' });
    }
  } catch (error) {
    console.error('Superset Auto Login: Error in context menu handler:', error);
  }
});

// Alarm for periodic credential check (optional)
chrome.alarms.create('checkCredentials', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkCredentials') {
    const data = await chrome.storage.local.get(['username', 'password']);
    if (!data.username || !data.password) {
      console.log('Superset Auto Login: No credentials configured');
    }
  }
});
