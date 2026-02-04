# 🚀 Quick Installation Guide

## 📋 Prerequisites

- ✅ Google Chrome or Chromium browser
- ✅ Apache Superset running (e.g., `http://localhost:8088`)
- ✅ Superset credentials (username and password)

## ⚡ 3-Minute Setup

### Step 1: Load Extension (1 minute)

1. Open Chrome
2. Go to: `chrome://extensions/`
3. Enable **"Developer mode"** (toggle in top right)
4. Click **"Load unpacked"**
5. Navigate to and select the folder:
   ```
   C:\Users\Admin\Documents\projects\superset\superset\chrome-extension-superset-autologin
   ```
6. ✅ Extension loaded!

### Step 2: Configure (1 minute)

1. Click the extension icon (🔐) in Chrome toolbar
   - If you don't see it, click the puzzle icon and pin it
2. Fill in the form:
   - **Superset URL**: `http://localhost:8088`
   - **Username**: `admin` (or your username)
   - **Password**: Your Superset password
3. Keep **"Enable automatic login"** checked
4. Click **"💾 Save Credentials"**

### Step 3: Test (1 minute)

1. Click **"🧪 Test Login"**
2. Wait for the message: "✅ Login test successful!"
3. Done! 🎉

## 🎯 Usage

### Automatic Login

Just visit: `http://localhost:8088/login`

The extension will automatically:
1. Fill in your username
2. Fill in your password
3. Click the login button
4. You're logged in! ✨

### Manual Login

1. Click the extension icon
2. Click **"🚀 Login Now"**

## ✅ Verify It's Working

1. **Open a new incognito window** (Ctrl+Shift+N)
2. Go to: `chrome://extensions/`
3. Enable the extension in incognito mode (toggle)
4. Visit: `http://localhost:8088/login`
5. Watch it auto-login! 🎉

## 🔧 Troubleshooting

### Extension not visible?
- Click the puzzle icon (🧩) in Chrome toolbar
- Find "Superset Auto Login"
- Click the pin icon to keep it visible

### Auto-login not working?
1. Check the extension icon - should show green status
2. Click "🧪 Test Login" to verify credentials
3. Make sure you're on the login page: `/login`
4. Check browser console (F12) for errors

### "Login failed" error?
- Verify your password is correct
- Make sure Superset is running: `docker ps`
- Try logging in manually first to confirm credentials

## 🎨 Visual Guide

```
┌─────────────────────────────────────────┐
│  Chrome Extensions (chrome://extensions) │
├─────────────────────────────────────────┤
│                                          │
│  [X] Developer mode                     │
│                                          │
│  [Load unpacked] [Pack extension]       │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │ 🔐 Superset Auto Login             │ │
│  │ Version 1.0.0                      │ │
│  │ [Details] [Remove] [🔄]            │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## 📱 Quick Reference

| Action | How |
|--------|-----|
| **Open settings** | Click extension icon |
| **Auto-login** | Visit `/login` page |
| **Manual login** | Click "🚀 Login Now" |
| **Test credentials** | Click "🧪 Test Login" |
| **Clear data** | Click "🗑️ Clear Saved Data" |
| **Disable auto-login** | Uncheck "Enable automatic login" |

## 🔒 Security Note

⚠️ **Important:**
- Credentials are stored **locally** in your browser
- Use only on **trusted devices**
- Not recommended for **production credentials**
- Perfect for **local development**

## 🎉 You're Done!

The extension is now ready to use. Every time you visit the Superset login page, it will automatically log you in.

**Enjoy your automated Superset experience!** 🚀

---

Need help? Check the full [README.md](README.md) for detailed documentation.
