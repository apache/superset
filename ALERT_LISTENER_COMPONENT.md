# Dashboard Alert Listener Component

## Overview

The **Alerts** component is a draggable, configurable MQTT notification listener that can be added to any Superset dashboard. Unlike the previous global notification approach, each dashboard can now have its own dedicated alert listeners with custom topics and filtering rules.

## Features

✅ **Drag-and-drop** - Add from the component panel like Button or Model3D  
✅ **Per-dashboard configuration** - Each alert listener has its own MQTT topic  
✅ **Custom topics** - Subscribe to any MQTT topic pattern  
✅ **Global topic support** - Optionally include the shared `smartLight/events` topic  
✅ **Filtering** - Filter by event type or severity levels  
✅ **Visual indicator** - Shows connection status with color-coded icons  
✅ **Toast notifications** - Displays real-time toasts based on message severity  
✅ **Configurable** - Full configuration UI with validation  

## How to Use

### 1. Add Alert Listener to Dashboard

1. Open a dashboard in **Edit mode**
2. Look for the **Alerts** component in the left sidebar (Components panel)
3. **Drag and drop** the Alerts component onto your dashboard
4. The component will appear with a bell icon and "Configure topic" message

### 2. Configure the Alert Listener

1. Hover over the Alert Listener component
2. Click the **⚙️ Settings icon** in the hover menu
3. Configure the following options:

#### MQTT Topic Configuration

**Custom Topic** (Required)
- Enter the MQTT topic you want to subscribe to
- Examples:
  - `sensors/temperature` - Specific sensor topic
  - `dashboard/123/events` - Dashboard-specific events
  - `devices/+/alerts` - Wildcard for all devices
  - `building/floor1/#` - Hierarchical wildcard

**Include Global Topic**
- Toggle ON to also receive messages from `smartLight/events`
- Toggle OFF to only listen to your custom topic

#### Filters

**Event Type Filter** (Optional)
- Enter text to filter events by type
- Case-insensitive matching
- Example: Enter "Critical" to only show critical events

**Severity Filter** (Optional)
- Select which severity levels to show:
  - ✅ Info (blue toast)
  - ✅ Success (green toast)
  - ✅ Warning (yellow toast)
  - ✅ Error (red toast)
- Leave empty to show all severities

#### Display Options

**Show Visual Indicator**
- Shows a colored indicator when the listener is active
- Changes color based on connection status

**Indicator Color**
- Customize the color of the visual indicator
- Uses a color picker

### 3. Save Configuration

Click **Save** to apply your configuration. The component will:
- Connect to the MQTT broker automatically
- Subscribe to your configured topic(s)
- Start showing toast notifications for incoming events

### 4. Test the Configuration

Use the backend test API to send a test notification:

```bash
POST http://localhost:5100/5508enb-y315/api/mqtt/test

{
  "topic": "sensors/temperature",  // Your custom topic
  "message": "High temperature detected",
  "severity": "warning",
  "deviceName": "Sensor-01",
  "description": "Temperature exceeded threshold"
}
```

Or open the test dashboard:
```
http://localhost:5100/5508enb-y315/mqtt-test.html
```

## Multiple Dashboards Example

### Dashboard 1: Temperature Monitoring
- **Topic**: `sensors/temperature`
- **Severity Filter**: error, warning
- **Use Case**: Only show temperature alerts above threshold

### Dashboard 2: All Device Events
- **Topic**: `devices/+/events`
- **Include Global**: ON
- **Use Case**: Monitor all device events plus global notifications

### Dashboard 3: Building Security
- **Topic**: `security/building1/#`
- **Event Filter**: "unauthorized"
- **Use Case**: Security-specific alerts only

## Connection Status Icons

- 🔔 **Bell Icon** - Not configured yet
- ⚠️ **Alert Icon** - Topic not configured
- 🔄 **Loading** - Connecting to MQTT broker
- ✅ **Green Check** - Connected and listening
- ❌ **Red X** - Connection error

## Message Format

The Alerts component expects MQTT messages in the following JSON format:

```json
{
  "message": "Event title",
  "eventType": "Alert Type",
  "deviceName": "Device-01",
  "deviceId": "device-123",
  "description": "Detailed description",
  "severity": "warning",  // "info" | "success" | "warning" | "error"
  "timestamp": "2025-12-02T10:30:00Z",
  "data": {
    // Optional additional data
  }
}
```

## Toast Display Logic

1. **Filtering**: Message passes event filter AND severity filter
2. **Message Building**: 
   - If `deviceName` or `deviceId` exists: `"{device} • {description}"`
   - Otherwise: Shows `message` or `eventType`
3. **Toast Type**: Based on severity
   - `error` → Red danger toast
   - `warning` → Yellow warning toast
   - `success` → Green success toast
   - `info` → Blue info toast

## Architecture

### Component Structure
```
gridComponents/
  Alerts/
    Alerts.tsx                  # Main component with MQTT logic
    AlertsConfigMenuItem.tsx    # Configuration modal
    types.ts                    # TypeScript interfaces
    index.ts                    # Export
```

### MQTT Configuration
- **Broker**: `wss://mqtt.snap4idtcity.com/`
- **Auth**: `webclient` / `root`
- **Protocol**: WebSocket Secure (WSS)
- **QoS**: 1 (at least once delivery)

### Key Features Implementation

**Dynamic Import**: Uses `await import('mqtt')` to load MQTT at runtime, avoiding webpack/CSP issues

**Connection Management**: 
- Auto-connects when dashboard loads (if configured)
- Disconnects when dashboard closes
- Reconnects on connection loss

**Per-Component Isolation**: Each Alert Listener has its own:
- MQTT client instance
- Topic subscriptions
- Filter settings
- Connection state

## Comparison: Old vs New Approach

### Old Approach (Global MqttEventListener)
❌ Single listener for entire dashboard  
❌ All dashboards receive same notifications  
❌ Topic configured in dashboard JSON metadata  
❌ Hard to manage multiple notification streams  

### New Approach (Alert Component)
✅ Multiple listeners per dashboard  
✅ Each listener has its own topic  
✅ Drag-and-drop configuration  
✅ Visual component with status indicators  
✅ Easy to add/remove/configure  

## Backend API Reference

### Test Endpoint
```
POST /api/mqtt/test
```

**Payload**:
```json
{
  "topic": "custom/topic",
  "message": "Event message",
  "severity": "info",
  "eventType": "Alert",
  "deviceName": "Device-01",
  "description": "Event details"
}
```

### Test Dashboard
```
GET /mqtt-test.html
```
Beautiful UI with preset buttons for testing different notification types.

## Troubleshooting

### No notifications appearing
1. Check connection status indicator (should be green)
2. Verify topic name is correct
3. Check if filters are too restrictive
4. Open browser console for MQTT logs: `[Alerts]`
5. Test with the backend API endpoint

### Connection error
1. Check if CSP allows `wss://mqtt.snap4idtcity.com`
2. Verify MQTT broker is running
3. Check network/firewall settings
4. Restart Superset Flask server

### Duplicate notifications
- Check if multiple Alert Listener components are subscribing to the same topic
- Each component creates its own subscription

## Development Notes

### Files Modified/Created

**New Components**:
- `Alerts.tsx` - Main alert listener component (500+ lines)
- `AlertsConfigMenuItem.tsx` - Configuration modal
- `types.ts` - TypeScript interfaces
- `NewAlerts.tsx` - Draggable component for sidebar

**Registration Files**:
- `componentTypes.ts` - Added `ALERTS_TYPE`
- `constants.ts` - Added `NEW_ALERTS_ID`
- `newComponentFactory.js` - Added default metadata
- `isValidChild.ts` - Added parent-child validation
- `shouldWrapChildInRow.ts` - Added layout rules
- `componentIsResizable.ts` - Made component resizable
- `gridComponents/index.js` - Added to component lookup
- `BuilderComponentPane/index.tsx` - Added to sidebar

**Removed**:
- Global `MqttEventListener` from `DashboardPage.tsx`

### CSP Configuration

Added to `superset/config.py`:
```python
"connect-src": [
    ...
    "wss://mqtt.snap4idtcity.com",
]
```

## Future Enhancements

🔮 **Notification History** - Show recent notifications in component  
🔮 **Sound Alerts** - Optional audio notifications  
🔮 **Badge Counter** - Show number of unread alerts  
🔮 **Custom Styling** - Customize toast appearance per component  
🔮 **Export/Import Config** - Share configurations between dashboards  
🔮 **Persistent State** - Remember acknowledged alerts  

## Summary

The new Alert Listener component provides a flexible, user-friendly way to manage real-time MQTT notifications in Superset dashboards. Each dashboard can now have multiple listeners with different topics and filters, making it perfect for monitoring different data streams simultaneously.

**Key Benefit**: Users can now configure alerts directly in the dashboard UI without editing JSON metadata or code!
