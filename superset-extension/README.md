# 🚀 QuickSet - Chrome Extension

A Chrome extension for quick access to Apache Superset dashboard metadata and exports without opening Superset.

## ✨ Features

- 🚀 **Quick Access** - View dashboard metadata without opening Superset
- 📊 **Dashboard Metadata** - Browse dashboard details, activity, and configuration
- 📥 **Easy Exports** - Export dashboard configs and chart data as CSV/JSON
- 🔗 **Shareable Links** - Generate dashboard permalinks instantly
- 💾 **Secure Storage** - Credentials stored locally in your browser
- 🌐 **Flexible URLs** - Connect to any Superset instance
- 🎨 **Beautiful UI** - Modern, user-friendly interface

## 📦 Installation

### Method 1: Load Unpacked (Development)

1. **Open Chrome Extensions Page**
   - Go to `chrome://extensions/`
   - Or click Menu (⋮) → More Tools → Extensions

2. **Enable Developer Mode**
   - Toggle "Developer mode" in the top right

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the `superset-extension` folder
   - The extension icon will appear in your toolbar

### Method 2: Pack and Install (Production)

1. **Pack the Extension**
   - Go to `chrome://extensions/`
   - Click "Pack extension"
   - Select the extension folder
   - This creates a `.crx` file

2. **Install the .crx**
   - Drag and drop the `.crx` file onto `chrome://extensions/`

## 🚀 Quick Start

### Step 1: Login

1. Click the extension icon in Chrome toolbar
2. Fill in your details:
   - **Superset URL**: Your Superset instance URL (e.g., `http://localhost:8088`)
   - **Username**: Your Superset username (e.g., `admin`)
   - **Password**: Your Superset password
3. Check "Remember password" to save credentials
4. Click "Login"

### Step 2: Browse Dashboards

1. After login, you'll see your dashboard list
2. Each dashboard card shows:
   - Dashboard title and owners
   - Last modified date
   - Quick action buttons

### Step 3: Access Dashboard Metadata

1. Click "📊 Dashboard Metadata" button on any dashboard
2. View comprehensive information:
   - Dashboard overview (charts, filters, layout)
   - Dashboard metadata (ID, slug, owners, tags)
   - Recent activity timeline
3. Export options available in separate tab

## 🎯 Usage

### Dashboard Actions

Each dashboard card provides multiple actions:

**Via Dropdown Menu (⋮):**
- 📊 **Dashboard Metadata** - View comprehensive dashboard info and activity
- 🔗 **Get Link** - Generate shareable permalink
- ℹ️ **Details** - View basic dashboard information
- 📊 **Charts** - List all charts and export chart data
- 📦 **Export Config** - Download dashboard configuration as ZIP
- 🔗 **Open** - Open dashboard in Superset

**Via Quick Action Buttons:**
- Same actions available as dedicated buttons for quick access

### Export Features

**Dashboard Configuration:**
- Click "📦 Export Config" to download dashboard as ZIP
- Contains YAML configuration for importing to other Superset instances

**Chart Data:**
- Access via "📊 Charts" or "📊 Dashboard Metadata"
- Export individual charts as CSV or JSON
- Export all chart data at once

### Search & Filter

- Use the search bar to filter dashboards by title or owner
- Real-time filtering as you type

### Logout

- Click the "Logout" button to clear session
- Credentials remain saved if "Remember password" was checked

## 🔒 Security

### How Credentials are Stored

- **Local Storage**: Credentials are stored in Chrome's local storage
- **Not Synced**: Data stays on your computer (not synced to Chrome account)
- **Basic Encoding**: Password is base64-encoded (basic obfuscation)
- **No External Servers**: No data is sent to external servers

### Security Considerations

⚠️ **Important Notes:**

1. This extension stores credentials **locally** in your browser
2. Base64 encoding is **NOT encryption** - it's just obfuscation
3. Anyone with access to your computer could potentially extract credentials
4. Use only on **trusted devices**
5. For production environments, consider using OAuth or SSO instead

### Recommended Use Cases

✅ **Good for:**
- Local development environments
- Personal testing instances
- Trusted devices only

❌ **Not recommended for:**
- Shared computers
- Production credentials
- Sensitive environments

## 🎨 Features in Detail

### Status Indicator

The extension shows your current status:
- 🟢 **Green**: Auto-login enabled and configured
- 🟡 **Yellow**: Configured but auto-login disabled
- 🔴 **Red**: Not configured

### Context Menu

Right-click anywhere to access:
- **Open Superset**: Opens Superset in a new tab
- **Login to Superset**: Opens Superset login page

### Badge Indicator

When on a Superset login page:
- **Green dot (●)**: Auto-login is active
- **Red exclamation (!)**: Login failed

## 🛠️ Configuration

### Supported URLs

The extension works with:
- `http://localhost:8088`
- `http://localhost:8089`
- `http://127.0.0.1:8088`
- `http://127.0.0.1:8089`

To add more URLs, edit `manifest.json`:

```json
"host_permissions": [
  "http://your-superset-url.com/*"
]
```

### Disable Auto-Login

To keep credentials saved but disable auto-login:
1. Open the extension popup
2. Uncheck "Enable automatic login"
3. Click "💾 Save Credentials"

You can still use "🚀 Login Now" for manual login.

## 🐛 Troubleshooting

### Extension doesn't auto-login

**Check:**
1. Auto-login is enabled (green status)
2. Credentials are saved correctly
3. You're on the correct Superset URL
4. The login form is visible on the page

**Try:**
- Click "🧪 Test Login" to verify credentials
- Check browser console for errors (F12)
- Reload the extension

### "Login failed" message

**Possible causes:**
1. Incorrect username or password
2. Superset is not running
3. Wrong Superset URL
4. Network connection issues

**Solutions:**
- Verify credentials in Superset directly
- Check Superset is running: `docker ps`
- Test the URL in a regular browser tab

### Form not detected

**If the extension can't find the login form:**
1. The page might use a different form structure
2. Check browser console for messages
3. Try refreshing the page

### Extension icon not showing

**Solutions:**
1. Pin the extension: Click puzzle icon → Pin
2. Reload the extension in `chrome://extensions/`
3. Restart Chrome

## 📁 File Structure

```
superset-extension/
├── manifest.json          # Extension configuration
├── popup.html            # Login page UI
├── popup.css             # Login page styles
├── popup.js              # Login logic
├── dashboard-list.html   # Dashboard list UI
├── dashboard-list.css    # Dashboard list styles
├── dashboard-list.js     # Dashboard list logic & API calls
├── content.js            # Content script (runs on Superset pages)
├── background.js         # Background service worker
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   └── icon.svg
└── README.md             # This file
```

## 🔧 Development

### Modify the Extension

1. Edit the files in `superset-extension/`
2. Go to `chrome://extensions/`
3. Click the reload icon (🔄) on your extension
4. Test your changes

### Debug

**Popup (Login):**
- Right-click extension icon → "Inspect popup"
- Or right-click on popup.html page → "Inspect"

**Dashboard List:**
- Right-click on dashboard-list.html page → "Inspect"

**Content Script:**
- Open DevTools on Superset page (F12)
- Check Console for messages starting with "Superset Auto Login:"

**Background:**
- Go to `chrome://extensions/`
- Click "Inspect views: service worker"

### API Endpoints Used

The extension uses these Superset API endpoints:
- `/api/v1/security/login` - Authentication
- `/api/v1/security/csrf_token/` - CSRF token for POST requests
- `/api/v1/dashboard/` - List dashboards
- `/api/v1/dashboard/{id}` - Dashboard details
- `/api/v1/dashboard/{id}/charts` - Dashboard charts
- `/api/v1/dashboard/{id}/permalink` - Generate permalink
- `/api/v1/chart/{id}` - Chart details
- `/api/v1/chart/data` - Chart data export
- `/api/v1/dashboard/export/` - Dashboard configuration export

## 📝 Changelog

### Version 2.0.0 (QuickSet) - February 5, 2026
- **Rebranded to "QuickSet"** - Focus on quick access to dashboard metadata
- **Custom URL Support** - Users can specify their own Superset instance URL
- **Dashboard Metadata Feature** - Renamed from "Data Browsing" for clarity
- **Export Capabilities** - Export dashboard configs and chart data
- **Shareable Links** - Generate dashboard permalinks
- **Browse Data Modal** - Tabbed interface for dashboard data and exports
- **Chart Data Export** - Individual and bulk export as CSV/JSON
- **Activity Timeline** - View dashboard creation and modification history
- **Modern UI** - Updated design with dropdown menus and action buttons

### Version 1.0.0
- Initial release
- Auto-login functionality
- Credential storage
- Dashboard listing
- Basic export features

## 🤝 Contributing

Feel free to improve this extension:

1. Add support for more Superset versions
2. Improve security (implement proper encryption)
3. Add more features (remember me, multiple accounts, etc.)
4. Improve UI/UX

## ⚠️ Disclaimer

This extension is provided "as is" without warranty. Use at your own risk. The authors are not responsible for any security issues or data loss.

**Remember:** Never store production credentials in browser extensions!

## 📄 License

This extension is created for use with Apache Superset, which is licensed under the Apache License 2.0.

## 🙏 Credits

- Built for **Apache Superset**
- Icons: (Add your icon source here)
- UI inspired by modern Chrome extensions

---

**QuickSet - Made with ❤️ for the Apache Superset Hackathon 2026**
