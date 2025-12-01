/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import mqtt from 'mqtt';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import type { RootState } from 'src/dashboard/types';

interface MqttConfig {
  enabled?: boolean;
  include_global?: boolean;
  custom_topic?: string;
  event_filter?: string;
  severity_filter?: string[];
}

interface MqttMessage {
  message?: string;
  eventType?: string;
  deviceName?: string;
  deviceId?: string;
  description?: string;
  severity?: 'info' | 'warning' | 'error' | 'success';
  dateObserved?: string;
  timestamp?: string;
  data?: any;
}

// MQTT Broker Configuration
const MQTT_BROKER_URL = 'wss://mqtt.snap4idtcity.com/';
const MQTT_USERNAME = 'webclient';
const MQTT_PASSWORD = 'root';
const GLOBAL_TOPIC = 'smartLight/events';

/**
 * MqttEventListener - Hybrid MQTT notification system for Superset dashboards
 * 
 * Features:
 * - Auto-subscribes to dashboard-specific topic: dashboard/{id}/events
 * - Optionally subscribes to global topic: smartLight/events
 * - Supports custom topics via dashboard metadata
 * - Configurable per-dashboard via json_metadata.mqtt_config
 * 
 * Metadata configuration example:
 * {
 *   "mqtt_config": {
 *     "enabled": true,
 *     "include_global": true,
 *     "custom_topic": "temperature/alerts",
 *     "event_filter": "Critical",
 *     "severity_filter": ["error", "warning"]
 *   }
 * }
 */
const MqttEventListener = () => {
  const { addInfoToast, addWarningToast, addDangerToast, addSuccessToast } = useToasts();
  const dashboardInfo = useSelector((state: RootState) => state.dashboardInfo);
  const clientRef = useRef<mqtt.MqttClient | null>(null);
  const isConnectedRef = useRef(false);

  useEffect(() => {
    const dashboardId = dashboardInfo?.id;
    
    // Don't initialize if no dashboard ID
    if (!dashboardId) {
      console.log('[MQTT] Waiting for dashboard info...');
      return;
    }

    // Get MQTT configuration from dashboard metadata
    const mqttConfig: MqttConfig = dashboardInfo?.metadata?.mqtt_config || {};
    
    // Check if MQTT is explicitly disabled for this dashboard
    if (mqttConfig.enabled === false) {
      console.log(`[MQTT] MQTT disabled for dashboard ${dashboardId}`);
      return;
    }

    console.log(`[MQTT] Initializing for dashboard ${dashboardId}`, mqttConfig);

    // Build topic subscription list
    const topics: string[] = [];
    
    // 1. Dashboard-specific topic (always included unless disabled)
    topics.push(`dashboard/${dashboardId}/events`);
    
    // 2. Global topic (included by default, can be disabled via metadata)
    if (mqttConfig.include_global !== false) {
      topics.push(GLOBAL_TOPIC);
    }
    
    // 3. Custom topic from metadata (optional)
    if (mqttConfig.custom_topic) {
      topics.push(mqttConfig.custom_topic);
    }

    console.log('[MQTT] Subscribing to topics:', topics);

    try {
      // Create MQTT client
      const client = mqtt.connect(MQTT_BROKER_URL, {
        reconnectPeriod: 5000,
        connectTimeout: 30000,
        clientId: `superset_dashboard_${dashboardId}_${Math.random().toString(16).substr(2, 8)}`,
        clean: true,
        keepalive: 60,
        username: MQTT_USERNAME,
        password: MQTT_PASSWORD,
        protocolVersion: 4,
      });

      clientRef.current = client;

      // Connection established
      client.on('connect', () => {
        console.log('[MQTT] Connected to broker');
        isConnectedRef.current = true;

        // Subscribe to all configured topics
        client.subscribe(topics, { qos: 1 }, (err) => {
          if (err) {
            console.error('[MQTT] Subscription error:', err);
            addDangerToast('Failed to subscribe to real-time notifications');
          } else {
            console.log('[MQTT] Successfully subscribed to:', topics.join(', '));
          }
        });
      });

      // Connection error
      client.on('error', (error) => {
        console.error('[MQTT] Connection error:', error);
        if (!isConnectedRef.current) {
          // Only show error on initial connection failure
          addDangerToast('Failed to connect to real-time notification service');
        }
      });

      // Connection lost
      client.on('offline', () => {
        console.log('[MQTT] Client went offline');
        isConnectedRef.current = false;
      });

      // Reconnection attempt
      client.on('reconnect', () => {
        console.log('[MQTT] Attempting to reconnect...');
      });

      // Connection closed
      client.on('close', () => {
        console.log('[MQTT] Connection closed');
        isConnectedRef.current = false;
      });

      // Message received
      client.on('message', (topic, payload) => {
        try {
          console.log(`[MQTT] Message received on topic: ${topic}`);
          const messageData: MqttMessage = JSON.parse(payload.toString());
          console.log('[MQTT] Parsed message:', messageData);

          // Apply event type filter if configured
          if (mqttConfig.event_filter) {
            const eventType = messageData.eventType || messageData.message || '';
            if (!eventType.toLowerCase().includes(mqttConfig.event_filter.toLowerCase())) {
              console.log(`[MQTT] Message filtered out by event_filter: ${mqttConfig.event_filter}`);
              return;
            }
          }

          // Apply severity filter if configured
          const severity = messageData.severity || 'info';
          if (mqttConfig.severity_filter && mqttConfig.severity_filter.length > 0) {
            if (!mqttConfig.severity_filter.includes(severity)) {
              console.log(`[MQTT] Message filtered out by severity_filter: ${severity}`);
              return;
            }
          }

          // Build toast message
          let message = messageData.message || messageData.eventType || 'Event received';
          
          // Add device information if available
          if (messageData.deviceName || messageData.deviceId) {
            const deviceInfo = messageData.deviceName || messageData.deviceId;
            message = `${deviceInfo} • ${messageData.description || message}`;
          }

          // Display toast based on severity
          switch (severity) {
            case 'error':
              addDangerToast(message);
              break;
            case 'warning':
              addWarningToast(message);
              break;
            case 'success':
              addSuccessToast(message);
              break;
            case 'info':
            default:
              addInfoToast(message);
              break;
          }

          // Log additional data if present
          if (messageData.data) {
            console.log('[MQTT] Additional event data:', messageData.data);
          }
        } catch (error) {
          console.error('[MQTT] Error parsing message:', error);
          console.error('[MQTT] Raw payload:', payload.toString());
          
          // Try to show raw message if JSON parsing fails
          try {
            const rawMessage = payload.toString();
            if (rawMessage && rawMessage.length > 0 && rawMessage.length < 200) {
              addInfoToast(rawMessage);
            }
          } catch (e) {
            console.error('[MQTT] Failed to display raw message:', e);
          }
        }
      });

    } catch (error) {
      console.error('[MQTT] Failed to initialize MQTT client:', error);
      addDangerToast('Failed to initialize real-time notification service');
    }

    // Cleanup on unmount or dashboard change
    return () => {
      console.log('[MQTT] Cleaning up MQTT connection');
      if (clientRef.current) {
        clientRef.current.end(true, {}, () => {
          console.log('[MQTT] Connection closed successfully');
        });
        clientRef.current = null;
      }
      isConnectedRef.current = false;
    };
  }, [
    dashboardInfo?.id,
    dashboardInfo?.metadata?.mqtt_config,
    addInfoToast,
    addWarningToast,
    addDangerToast,
    addSuccessToast,
  ]);

  // This component doesn't render anything
  return null;
};

export default MqttEventListener;
