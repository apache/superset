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
import type { LayoutItemMeta } from 'src/dashboard/types';

export interface DashboardAlertsMeta extends LayoutItemMeta {
  // MQTT Topic Configuration
  mqttTopic?: string; // e.g., "dashboard/123/events" or "temperature/alerts"
  
  // Optional: Include global smartLight/events topic
  includeGlobalTopic?: boolean;
  
  // Filtering options
  eventFilter?: string; // Filter by event type (e.g., "Critical", "Warning")
  severityFilter?: string[]; // Filter by severity: ["error", "warning", "info", "success"]
  
  // Display options
  showVisualIndicator?: boolean; // Show a visual indicator when alerts are active
  indicatorColor?: string; // Color of the indicator (default: theme-based)
  
  // MQTT Connection options
  mqttBrokerUrl?: string; // Override default broker (optional)
  mqttUsername?: string; // Override default username (optional)
  mqttPassword?: string; // Override default password (optional)
}

export interface MqttMessage {
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
