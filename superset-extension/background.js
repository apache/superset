// Background service worker for the extension

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
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
  } catch (error) {
    // Context menus may already exist on update
  }
});

// Detect Superset login page
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      const { supersetUrl } = await chrome.storage.local.get(['supersetUrl']);

      if (supersetUrl) {
        const supersetHost = new URL(supersetUrl).hostname;
        if (tab.url.includes(supersetHost) && tab.url.includes('/login')) {
          chrome.action.setBadgeText({ text: '●', tabId });
          chrome.action.setBadgeBackgroundColor({ color: '#28a745', tabId });
        }
      }
    } catch (error) {
      // Ignore URL parsing errors
    }
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'loginSuccess' && sender.tab) {
    chrome.action.setBadgeText({ text: '', tabId: sender.tab.id });
    sendResponse({ success: true });
  } else if (request.action === 'loginFailed' && sender.tab) {
    chrome.action.setBadgeText({ text: '!', tabId: sender.tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#dc3545', tabId: sender.tab.id });
    sendResponse({ success: false });
  }
  return true;
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const { supersetUrl } = await chrome.storage.local.get(['supersetUrl']);

  if (!supersetUrl) return;

  if (info.menuItemId === 'openSuperset') {
    chrome.tabs.create({ url: supersetUrl });
  } else if (info.menuItemId === 'loginToSuperset') {
    chrome.tabs.create({ url: supersetUrl + '/login' });
  }
});

// Periodic credential check
chrome.alarms.create('checkCredentials', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkCredentials') {
    await chrome.storage.local.get(['username', 'password']);
  }
});
