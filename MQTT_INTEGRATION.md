# MQTT Real-Time Notifications for Superset Dashboards

## 📡 Implementation Summary

Successfully integrated **hybrid MQTT notification system** into Superset dashboards.

## ✅ Completed Changes

### 1. **MqttEventListener Component**
   - Location: `superset-frontend/src/dashboard/components/MqttEventListener/MqttEventListener.tsx`
   - Features:
     - Auto-subscribes to `dashboard/{id}/events` for each dashboard
     - Subscribes to global `smartLight/events` topic by default
     - Supports custom topics via dashboard metadata
     - Configurable filters (event type, severity)
     - Redux toast integration

### 2. **MQTT Dependency**
   - Added `mqtt: ^5.14.1` to package.json
   - Same version as your IoT application

### 3. **DashboardPage Integration**
   - Mounted `<MqttEventListener />` in all dashboards
   - Automatically initializes when dashboard loads

## 🎯 Topic Subscription Strategy

Each dashboard automatically subscribes to:

1. **Dashboard-specific**: `dashboard/{dashboard_id}/events`
   - Unique per dashboard
   - Backend can target specific dashboards

2. **Global broadcasts**: `smartLight/events`
   - Shared across all dashboards
   - Can be disabled via metadata

3. **Custom topics** (optional): Configured via dashboard metadata
   - Add additional topics per dashboard

## 🔧 Configuration Options

### Default Behavior (No Configuration)
- ✅ Subscribes to `dashboard/{id}/events`
- ✅ Subscribes to `smartLight/events`
- ✅ Shows all messages as toasts

### Advanced Configuration via Dashboard Metadata

Edit dashboard → Advanced → JSON Metadata:

```json
{
  "mqtt_config": {
    "enabled": true,
    "include_global": true,
    "custom_topic": "temperature/alerts",
    "event_filter": "Critical",
    "severity_filter": ["error", "warning"]
  }
}
```

#### Configuration Options:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable MQTT for this dashboard |
| `include_global` | boolean | `true` | Subscribe to global `smartLight/events` topic |
| `custom_topic` | string | `null` | Additional custom topic to subscribe to |
| `event_filter` | string | `null` | Filter messages by event type (case-insensitive substring match) |
| `severity_filter` | array | `[]` | Only show messages with these severity levels: `["info", "warning", "error", "success"]` |

### Configuration Examples

#### Dashboard 1: Smart Lights (Default)
```json
{}
```
Subscribes to:
- `dashboard/1/events`
- `smartLight/events`

#### Dashboard 2: Temperature Monitoring (Custom Topic)
```json
{
  "mqtt_config": {
    "include_global": false,
    "custom_topic": "temperature/sensors"
  }
}
```
Subscribes to:
- `dashboard/2/events`
- `temperature/sensors`

#### Dashboard 3: Critical Alerts Only
```json
{
  "mqtt_config": {
    "event_filter": "Critical",
    "severity_filter": ["error", "warning"]
  }
}
```
Subscribes to:
- `dashboard/3/events`
- `smartLight/events`
Filters: Only shows Critical events with error/warning severity

#### Dashboard 4: Disabled
```json
{
  "mqtt_config": {
    "enabled": false
  }
}
```
No MQTT connection

## 📨 Message Format

Your backend should publish messages in this format:

```json
{
  "message": "AQI Unhealthy",
  "eventType": "Air Quality Alert",
  "deviceName": "Sensor-123",
  "deviceId": "abc-456",
  "description": "PM2.5 levels exceeded threshold",
  "severity": "warning",
  "dateObserved": "2025-12-01T10:30:00Z",
  "data": {
    "pm25": 156,
    "location": "Zone A"
  }
}
```

### Severity Mapping

| Severity | Toast Type | Color |
|----------|-----------|-------|
| `info` | Info Toast | Blue |
| `warning` | Warning Toast | Orange |
| `error` | Error Toast | Red |
| `success` | Success Toast | Green |

## 🚀 Next Steps

### 1. Install Dependencies
```bash
cd superset-frontend
npm install
```

### 2. Build Superset
```bash
npm run build
# or for development
npm run dev
```

### 3. Test Backend Publishing

#### Global Broadcast (All Dashboards)
```javascript
// Your backend (utils/mqttClient.js)
mqttClient.publish('smartLight/events', JSON.stringify({
  message: "Smart Light Alert",
  eventType: "LED Status Change",
  deviceName: "Light-001",
  severity: "info",
  description: "LED turned ON"
}));
```

#### Dashboard-Specific Message
```javascript
// Send to dashboard ID 5 only
mqttClient.publish('dashboard/5/events', JSON.stringify({
  message: "Dashboard-specific alert",
  severity: "warning"
}));
```

#### Custom Topic
```javascript
// For dashboards configured with "temperature/alerts"
mqttClient.publish('temperature/alerts', JSON.stringify({
  message: "Temperature spike detected",
  severity: "error",
  data: { temp: 85, unit: "°C" }
}));
```

## 🔍 Debugging

Check browser console for MQTT logs:
```
[MQTT] Initializing for dashboard 1 { include_global: true }
[MQTT] Subscribing to topics: [ 'dashboard/1/events', 'smartLight/events' ]
[MQTT] Connected to broker
[MQTT] Successfully subscribed to: dashboard/1/events, smartLight/events
[MQTT] Message received on topic: smartLight/events
[MQTT] Parsed message: { message: "...", severity: "warning" }
```

## 📋 MQTT Connection Details

- **Broker**: `wss://mqtt.snap4idtcity.com/`
- **Username**: `webclient`
- **Password**: `root`
- **Protocol**: WebSocket Secure (WSS)
- **QoS**: 1
- **Reconnect**: Automatic (every 5 seconds)

## 🎨 Future Enhancements

To add UI for MQTT configuration:

1. **Dashboard Edit Form**:
   - Add "Real-Time Notifications" section
   - Checkbox for enable/disable
   - Topic input field
   - Event/severity filter dropdowns

2. **Connection Status Indicator**:
   - Show MQTT connection status in dashboard header
   - Green dot = connected, Red = disconnected

3. **Toast Customization**:
   - Per-dashboard toast duration
   - Sound notifications
   - Desktop notifications (browser permission)

## ✨ Benefits of Hybrid Approach

✅ **Zero Configuration**: Works immediately for all dashboards  
✅ **Dashboard-Specific**: Backend can target individual dashboards  
✅ **Global Broadcasting**: Share alerts across all dashboards  
✅ **Flexible**: Add custom topics as needed  
✅ **Filterable**: Control what messages appear per dashboard  
✅ **Scalable**: Each dashboard manages its own subscriptions
