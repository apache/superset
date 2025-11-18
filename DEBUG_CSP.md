# Debugging CSP Issue for Button API Calls

## Steps to Verify and Fix

### 1. Verify Server Restart
Make sure you **completely restarted** your Superset server after making config changes.

### 2. Check CSP Header in Browser
1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Reload the dashboard page
4. Click on any request (e.g., the main page request)
5. Go to **Headers** tab
6. Look for `Content-Security-Policy` header
7. Check if `https://app.idtcities.com` is in the `connect-src` directive

### 3. Clear Browser Cache
- **Chrome/Edge**: `Ctrl+Shift+Delete` → Clear cached images and files
- Or use **Incognito/Private mode** to test

### 4. Verify Talisman is Enabled
Check your server logs when starting Superset - it should show Talisman is active.

### 5. Test with Environment Variable
Set the environment variable before starting Superset:
```bash
export SUPERSET_ADDITIONAL_CONNECT_SOURCES="https://app.idtcities.com"
# Then start Superset
```

### 6. Check for Multiple CSP Headers
Sometimes multiple CSP headers can conflict. Check if there are multiple `Content-Security-Policy` headers in the response.

