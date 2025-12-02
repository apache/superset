# Alerts Component Implementation & Troubleshooting Guide

## What We Did

Created a new draggable **Alerts** component for Superset dashboards that allows users to configure custom MQTT topics for real-time notifications. Each dashboard can have multiple Alert Listener components with different topics.

### Files Created

1. **Component Files** (in `superset-frontend/src/dashboard/components/gridComponents/Alerts/`):
   - `Alerts.tsx` - Main component with MQTT subscription logic (614 lines)
   - `AlertsConfigMenuItem.tsx` - Configuration modal UI (287 lines)
   - `types.ts` - TypeScript interfaces (51 lines)
   - `index.ts` - Export file (19 lines)

2. **Draggable Component**:
   - `superset-frontend/src/dashboard/components/gridComponents/new/NewAlerts.tsx` - Sidebar component (35 lines)

### Files Modified

1. **Type Registrations**:
   - `superset-frontend/src/dashboard/util/componentTypes.ts` - Added `ALERTS_TYPE = 'ALERTS'`
   - `superset-frontend/src/dashboard/util/constants.ts` - Added `NEW_ALERTS_ID = 'NEW_ALERTS_ID'`

2. **Component Factory**:
   - `superset-frontend/src/dashboard/util/newComponentFactory.js` - Added ALERTS_TYPE with default metadata

3. **Validation & Layout**:
   - `superset-frontend/src/dashboard/util/isValidChild.ts` - Added ALERTS_TYPE to parent-child validation
   - `superset-frontend/src/dashboard/util/shouldWrapChildInRow.ts` - Added ALERTS_TYPE to layout rules
   - `superset-frontend/src/dashboard/util/componentIsResizable.ts` - Made ALERTS_TYPE resizable

4. **Component Registration**:
   - `superset-frontend/src/dashboard/components/gridComponents/index.js` - Added Alerts import and componentLookup entry
   - `superset-frontend/src/dashboard/components/BuilderComponentPane/index.tsx` - Added NewAlerts to sidebar

5. **Dashboard Page**:
   - `superset-frontend/src/dashboard/containers/DashboardPage.tsx` - Removed global MqttEventListener (replaced by per-component alerts)

6. **Backend CSP**:
   - `superset/config.py` - Added `wss://mqtt.snap4idtcity.com` to CSP connect-src for both TALISMAN_CONFIG and TALISMAN_DEV_CONFIG

## Current Issue

### Error Message
```
Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined. You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.

Check the render method of `UnwrappedDragDroppable`.
```

### Root Cause
Webpack cannot find/import the Alerts component. The error occurs when trying to drag the Alerts component onto the dashboard.

### Why It's Happening
1. Webpack hasn't recompiled after adding new files
2. Module resolution issue with TypeScript imports
3. Cache not cleared properly

## How to Resolve

### Step 1: Verify Files Exist
```bash
cd ~/Services/superset-1/superset-frontend
ls -la src/dashboard/components/gridComponents/Alerts/
```

**Expected output:**
```
Alerts.tsx
AlertsConfigMenuItem.tsx
index.ts
types.ts
```

### Step 2: Check File Contents

**Verify index.ts:**
```bash
cat src/dashboard/components/gridComponents/Alerts/index.ts
```

**Should contain:**
```typescript
export { default } from './Alerts';
```

**Verify Alerts.tsx has export:**
```bash
tail -5 src/dashboard/components/gridComponents/Alerts/Alerts.tsx
```

**Should show:**
```typescript
export default DashboardAlerts;
```

### Step 3: Verify Component Registration

**Check gridComponents/index.js:**
```bash
grep -A2 -B2 "Alerts" src/dashboard/components/gridComponents/index.js
```

**Should show:**
```javascript
import Alerts from './Alerts';
...
[ALERTS_TYPE]: Alerts,
```

### Step 4: Clear All Caches
```bash
cd ~/Services/superset-1/superset-frontend

# Remove all cache directories
rm -rf node_modules/.cache
rm -rf .webpack-cache
rm -rf dist
rm -rf build

# Clear npm cache (optional but recommended)
npm cache clean --force
```

### Step 5: Reinstall Dependencies
```bash
cd ~/Services/superset-1/superset-frontend

# Reinstall to ensure mqtt package is installed
npm install
```

### Step 6: Kill Existing Webpack Process
```bash
# Find and kill any running webpack processes
ps aux | grep webpack
kill -9 <PID>

# Or kill all node processes (if safe)
pkill -f webpack
pkill -f node
```

### Step 7: Restart Webpack Dev Server
```bash
cd ~/Services/superset-1/superset-frontend

# Start with verbose logging to see any errors
npm run dev
```

**Watch for compilation errors in the output!**

### Step 8: Restart Flask Server (for CSP changes)
```bash
cd ~/Services/superset-1

# Stop current Flask server (Ctrl+C)
# Then restart with:
superset run -p 8088 --with-threads --reload --debugger
```

## Alternative Fix: Change index.ts to index.js

If the issue persists, try renaming the index file:

```bash
cd ~/Services/superset-1/superset-frontend/src/dashboard/components/gridComponents/Alerts/

# Rename index.ts to index.js
mv index.ts index.js
```

Then edit `index.js` to:
```javascript
import Alerts from './Alerts';
export default Alerts;
```

## Verification Steps

### 1. Check Webpack Compilation
After running `npm run dev`, you should see:
```
✓ Compiled successfully
```

Look for any errors mentioning "Alerts" or "Cannot find module"

### 2. Check Browser Console
Open browser DevTools console and look for:
- Import errors
- Module resolution errors
- "Cannot find module" errors

### 3. Test Component Visibility
1. Open Superset in browser
2. Open a dashboard in edit mode
3. Look in the left sidebar (Components panel)
4. You should see "Alerts" with a bell icon 🔔

### 4. Test Drag and Drop
1. Try to drag the Alerts component onto the dashboard
2. If error occurs, check browser console for details

## Expected Behavior After Fix

1. **Sidebar**: Alerts component appears with bell icon
2. **Drag**: Can drag onto dashboard canvas
3. **Configure**: Click ⚙️ settings to open config modal
4. **Fields**:
   - Custom Topic (required)
   - Include Global Topic (toggle)
   - Event Type Filter (optional)
   - Severity Filter (optional)
   - Visual indicator settings
5. **Save**: Component shows connection status
6. **Toast**: Notifications appear when MQTT messages received

## Testing After Resolution

### Test 1: Component Appears
```bash
# Component should be visible in sidebar
# No console errors
```

### Test 2: Configuration Works
```bash
# Click settings icon
# Modal opens with form fields
# Can enter topic name
# Can save configuration
```

### Test 3: MQTT Connection
```bash
# Component shows "Connected" status with green checkmark
# Browser console shows: [Alerts] Connected to MQTT broker
```

### Test 4: Receive Notifications
```bash
# Send test message from backend
curl -X POST http://localhost:5100/5508enb-y315/api/mqtt/test \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "sensors/temperature",
    "message": "Test alert",
    "severity": "warning"
  }'

# Toast notification should appear
```

## Common Issues & Solutions

### Issue 1: "Cannot find module './Alerts'"
**Solution**: Webpack needs explicit file extension
```javascript
// In index.ts, try:
export { default } from './Alerts.tsx';
```

### Issue 2: Component is undefined
**Solution**: Check export/import pattern matches other components
```bash
# Compare with Button component
diff src/dashboard/components/gridComponents/Button/index.ts \
     src/dashboard/components/gridComponents/Alerts/index.ts
```

### Issue 3: CSP blocks WebSocket
**Solution**: Verify CSP configuration
```bash
grep -A20 "TALISMAN_CONFIG" superset/config.py | grep mqtt
# Should show: "wss://mqtt.snap4idtcity.com",
```

### Issue 4: mqtt package not found
**Solution**: Install dependencies
```bash
cd superset-frontend
npm install mqtt@5.14.1
```

## Debug Commands

### Check if files are committed
```bash
git status
git diff src/dashboard/components/gridComponents/
```

### Search for component references
```bash
cd ~/Services/superset-1/superset-frontend
grep -r "ALERTS_TYPE" src/dashboard/
grep -r "NewAlerts" src/dashboard/
grep -r "import Alerts" src/dashboard/
```

### Check webpack output
```bash
# Run webpack and capture output
npm run dev 2>&1 | tee webpack.log
# Then search for errors:
grep -i "error" webpack.log
grep -i "alerts" webpack.log
```

## Last Resort: Manual Component Check

If nothing works, verify the component can be imported in a test file:

```bash
cd ~/Services/superset-1/superset-frontend

# Create test file
cat > test-alerts-import.js << 'EOF'
import Alerts from './src/dashboard/components/gridComponents/Alerts';
console.log('Alerts component:', typeof Alerts);
EOF

# Try to run (will likely fail but shows specific error)
npx babel-node test-alerts-import.js

# Clean up
rm test-alerts-import.js
```

## Contact Information for Further Help

If the issue persists after all these steps, provide:
1. Webpack compilation output (full log)
2. Browser console errors (screenshots)
3. Output of: `ls -laR src/dashboard/components/gridComponents/Alerts/`
4. Output of: `grep -n "Alerts" src/dashboard/components/gridComponents/index.js`
5. Node version: `node --version`
6. NPM version: `npm --version`

## Summary Commands (Run in Order)

```bash
# 1. Navigate
cd ~/Services/superset-1/superset-frontend

# 2. Verify files
ls -la src/dashboard/components/gridComponents/Alerts/

# 3. Clear caches
rm -rf node_modules/.cache .webpack-cache dist build

# 4. Install dependencies
npm install

# 5. Kill processes
pkill -f webpack

# 6. Restart webpack
npm run dev

# 7. In another terminal, restart Flask
cd ~/Services/superset-1
# Stop current server (Ctrl+C), then:
superset run -p 8088 --with-threads --reload --debugger
```

Then test in browser!
