# 🔐 Superset Auto Login - Chrome Extension

A Chrome extension that automatically logs you into Apache Superset with saved credentials.

## ✨ Features

- 🚀 **Automatic Login** - Automatically fills and submits login form
- 💾 **Secure Storage** - Credentials stored locally in your browser
- 🎨 **Beautiful UI** - Modern, gradient-based interface
- 🧪 **Test Login** - Test your credentials before saving
- 🔄 **Manual Trigger** - Login on demand with one click
- 🌐 **Flexible URLs** - Works with any Superset instance
- 🎯 **Context Menu** - Quick access from right-click menu

## 📦 Installation

### Method 1: Load Unpacked (Development)

1. **Open Chrome Extensions Page**
   - Go to `chrome://extensions/`
   - Or click Menu (⋮) → More Tools → Extensions

2. **Enable Developer Mode**
   - Toggle "Developer mode" in the top right

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the `chrome-extension-superset-autologin` folder
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

### Step 1: Configure Credentials

1. Click the extension icon in Chrome toolbar
2. Fill in your details:
   - **Superset URL**: `http://localhost:8088`
   - **Username**: Your Superset username (e.g., `admin`)
   - **Password**: Your Superset password
3. Check "Enable automatic login"
4. Click "💾 Save Credentials"

### Step 2: Test the Login

1. Click "🧪 Test Login" to verify credentials
2. You should see "✅ Login test successful!"

### Step 3: Use Auto-Login

**Option A: Automatic**
- Just visit `http://localhost:8088/login`
- The extension will automatically log you in

**Option B: Manual**
- Click the extension icon
- Click "🚀 Login Now"

## 🎯 Usage

### Auto-Login

When you visit the Superset login page, the extension will:
1. Detect the login form
2. Fill in your username and password
3. Submit the form automatically
4. Show a brief indicator: "🔐 Auto-login active"

### Manual Login

If you want to trigger login manually:
1. Visit any Superset page
2. Click the extension icon
3. Click "🚀 Login Now"

### Test Credentials

To verify your credentials without logging in:
1. Click the extension icon
2. Click "🧪 Test Login"
3. Check the notification

### Clear Data

To remove all saved credentials:
1. Click the extension icon
2. Click "🗑️ Clear Saved Data"
3. Confirm the action

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
chrome-extension-superset-autologin/
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup UI
├── popup.css             # Popup styles
├── popup.js              # Popup logic
├── content.js            # Content script (runs on Superset pages)
├── background.js         # Background service worker
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # This file
```

## 🔧 Development

### Modify the Extension

1. Edit the files in `chrome-extension-superset-autologin/`
2. Go to `chrome://extensions/`
3. Click the reload icon (🔄) on your extension
4. Test your changes

### Debug

**Popup:**
- Right-click extension icon → "Inspect popup"

**Content Script:**
- Open DevTools on Superset page (F12)
- Check Console for messages starting with "Superset Auto Login:"

**Background:**
- Go to `chrome://extensions/`
- Click "Inspect views: service worker"

### Add Custom Selectors

If Superset uses different form elements, edit `content.js`:

```javascript
const usernameSelectors = [
  'input[name="username"]',
  'input[id="your-custom-id"]',  // Add your selector
];
```

## 📝 Changelog

### Version 1.0.0
- Initial release
- Auto-login functionality
- Credential storage
- Test login feature
- Manual login trigger
- Context menu integration

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

**Made with ❤️ for easier Superset development**
