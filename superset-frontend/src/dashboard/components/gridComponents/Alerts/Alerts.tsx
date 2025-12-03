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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '@superset-ui/core';
import { css, styled } from '@apache-superset/core/ui';
import { EditableTitle } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { Draggable } from 'src/dashboard/components/dnd/DragDroppable';
import HoverMenu from 'src/dashboard/components/menu/HoverMenu';
import WithPopoverMenu from 'src/dashboard/components/menu/WithPopoverMenu';
import DeleteComponentButton from 'src/dashboard/components/DeleteComponentButton';
import { ROW_TYPE } from 'src/dashboard/util/componentTypes';
import {
  GRID_MIN_COLUMN_COUNT,
} from 'src/dashboard/util/constants';
import type {
  LayoutItem,
  LayoutItemMeta,
} from 'src/dashboard/types';
import AlertsConfigMenuItem, {
  type AlertsConfig,
} from './AlertsConfigMenuItem';
import type { DashboardAlertsMeta, MqttMessage } from './types';
import { useAlertToasts } from './AlertToastContext';

const AlertsStyles = styled.div`
  ${({ theme }) => css`
    &.dashboard-alerts {
      /* Position absolutely to not take up layout space */
      position: fixed !important;
      bottom: 20px;
      left: 20px;
      z-index: 1000;
      
      /* Compact size for floating indicator */
      width: 180px !important;
      height: auto !important;
      
      display: flex;
      flex-direction: column;
      background-color: ${theme.colorBgContainer};
      border: 1px solid ${theme.colorBorder};
      border-radius: ${theme.borderRadius}px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

      /* Hide in view mode, only show in edit mode */
      .dashboard:not(.dashboard--editing) & {
        display: none !important;
        visibility: hidden;
      }

      .dashboard--editing & {
        cursor: move;
      }

      .dashboard-component-chart-holder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: ${theme.sizeUnit * 2}px;
        gap: ${theme.sizeUnit}px;
      }

      .alerts-icon {
        font-size: 24px;
        color: ${theme.colorPrimary};
        
        &.connected {
          color: ${theme.colorSuccess};
        }
        
        &.error {
          color: ${theme.colorError};
        }
      }

      .alerts-title {
        font-size: ${theme.fontSizeBase}px;
        font-weight: ${theme.fontWeightBold};
        color: ${theme.colorText};
        text-align: center;
      }

      .alerts-topic {
        font-size: ${theme.fontSizeXs}px;
        color: ${theme.colorTextSecondary};
        background-color: ${theme.colorBgElevated};
        padding: ${theme.sizeUnit * 0.5}px ${theme.sizeUnit}px;
        border-radius: ${theme.borderRadiusXs}px;
        font-family: ${theme.fontFamilyCode};
        word-break: break-all;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }
    }
  `}
`;

// Default MQTT Configuration
const MQTT_BROKER_URL = 'wss://mqtt.snap4idtcity.com/';
const MQTT_USERNAME = 'webclient';
const MQTT_PASSWORD = 'root';
const GLOBAL_TOPIC = 'smartLight/events';

const normalizeMeta = (meta: LayoutItemMeta): DashboardAlertsMeta => {
  const alertsMeta = meta as DashboardAlertsMeta;
  return {
    ...alertsMeta,
    mqttTopic: alertsMeta.mqttTopic ?? '',
    includeGlobalTopic: alertsMeta.includeGlobalTopic ?? true,
    eventFilter: alertsMeta.eventFilter ?? '',
    severityFilter: alertsMeta.severityFilter ?? [],
    showVisualIndicator: alertsMeta.showVisualIndicator ?? true,
    indicatorColor: alertsMeta.indicatorColor ?? '#1890ff',
  };
};

interface DashboardAlertsProps {
  id: string;
  parentId: string;
  component: LayoutItem;
  parentComponent: LayoutItem;
  index: number;
  depth: number;
  editMode: boolean;
  deleteComponent: (id: string, parentId: string) => void;
  handleComponentDrop: (dropResult: unknown) => void;
  updateComponents: (components: Record<string, LayoutItem>) => void;
}

const DashboardAlerts = ({
  id,
  parentId,
  component,
  parentComponent,
  index,
  depth,
  editMode,
  deleteComponent,
  handleComponentDrop,
  updateComponents,
}: DashboardAlertsProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('disconnected');
  const { addToast } = useAlertToasts();
  
  const clientRef = useRef<any>(null);
  const isConnectedRef = useRef(false);

  // Safety check
  if (!component || !component.meta) {
    console.error('DashboardAlerts: Missing component or meta', { component, id });
    return null;
  }

  const meta = useMemo(
    () => normalizeMeta(component.meta),
    [component.meta],
  );

  const updateMeta = useCallback(
    (updates: Partial<DashboardAlertsMeta>) => {
      updateComponents({
        [component.id]: {
          ...component,
          meta: {
            ...component.meta,
            ...updates,
          },
        },
      });
    },
    [component, updateComponents],
  );

  const handleChangeText = useCallback(
    (nextValue: string) => {
      if (meta.text !== nextValue) {
        updateMeta({ text: nextValue });
      }
    },
    [meta.text, updateMeta],
  );

  const handleDeleteComponent = useCallback(() => {
    deleteComponent(id, parentId);
  }, [deleteComponent, id, parentId]);

  const handleConfigSave = useCallback(
    (updates: AlertsConfig) => {
      updateMeta(updates);
    },
    [updateMeta],
  );

  const updateFocus = useCallback(
    (nextFocus: boolean) => {
      if (!nextFocus && isConfigModalOpen) {
        return;
      }
      setIsFocused(nextFocus);
    },
    [isConfigModalOpen],
  );

  const handleConfigVisibilityChange = useCallback((open: boolean) => {
    setIsConfigModalOpen(open);
    if (open) {
      setIsFocused(true);
    }
  }, []);

  // MQTT Connection Logic
  useEffect(() => {
    // Don't connect in edit mode or if topic is not configured
    if (editMode || !meta.mqttTopic || meta.mqttTopic.trim().length === 0) {
      setConnectionStatus('disconnected');
      return;
    }

    console.log('[Alerts] Initializing MQTT for component:', id);

    // Build topic subscription list
    const topics: string[] = [];
    
    // Custom topic from configuration
    if (meta.mqttTopic && meta.mqttTopic.trim().length > 0) {
      topics.push(meta.mqttTopic.trim());
    }
    
    // Global topic (optional)
    if (meta.includeGlobalTopic) {
      topics.push(GLOBAL_TOPIC);
    }

    if (topics.length === 0) {
      console.log('[Alerts] No topics configured');
      setConnectionStatus('disconnected');
      return;
    }

    console.log('[Alerts] Subscribing to topics:', topics);
    setConnectionStatus('connecting');

    // Dynamic import to load MQTT at runtime
    const connectMqtt = async () => {
      try {
        const mqttModule = await import('mqtt');
        const mqtt = mqttModule.default || mqttModule;
        
        const client = mqtt.connect(MQTT_BROKER_URL, {
          reconnectPeriod: 5000,
          connectTimeout: 30000,
          clientId: `superset_alerts_${id}_${Math.random().toString(16).substr(2, 8)}`,
          clean: true,
          keepalive: 60,
          username: MQTT_USERNAME,
          password: MQTT_PASSWORD,
          protocolVersion: 4,
        });

        clientRef.current = client;

        client.on('connect', () => {
          console.log('[Alerts] Connected to MQTT broker');
          isConnectedRef.current = true;
          setConnectionStatus('connected');

          client.subscribe(topics, { qos: 1 }, (err: any) => {
            if (err) {
              console.error('[Alerts] Subscription error:', err);
              setConnectionStatus('error');
            } else {
              console.log('[Alerts] Successfully subscribed to:', topics.join(', '));
            }
          });
        });

        client.on('error', (error: Error) => {
          console.error('[Alerts] Connection error:', error);
          setConnectionStatus('error');
        });

        client.on('offline', () => {
          console.log('[Alerts] Client went offline');
          isConnectedRef.current = false;
          setConnectionStatus('disconnected');
        });

        client.on('reconnect', () => {
          console.log('[Alerts] Attempting to reconnect...');
          setConnectionStatus('connecting');
        });

        client.on('close', () => {
          console.log('[Alerts] Connection closed');
          isConnectedRef.current = false;
          setConnectionStatus('disconnected');
        });

        client.on('message', (topic: string, payload: Buffer) => {
          try {
            console.log(`[Alerts] Message received on topic: ${topic}`);
            const messageData: MqttMessage = JSON.parse(payload.toString());
            console.log('[Alerts] Parsed message:', messageData);

            // Apply event type filter if configured
            if (meta.eventFilter && meta.eventFilter.trim().length > 0) {
              const eventType = messageData.eventType || messageData.message || '';
              if (!eventType.toLowerCase().includes(meta.eventFilter.toLowerCase())) {
                console.log(`[Alerts] Message filtered out by event_filter: ${meta.eventFilter}`);
                return;
              }
            }

            // Apply severity filter if configured
            const severity = messageData.severity || 'info';
            if (meta.severityFilter && meta.severityFilter.length > 0) {
              if (!meta.severityFilter.includes(severity)) {
                console.log(`[Alerts] Message filtered out by severity_filter: ${severity}`);
                return;
              }
            }

            // Build toast title and message
            let title = messageData.eventType || 'Event Notification';
            let message = messageData.message || messageData.description || '';
            
            // Add device information if available
            if (messageData.deviceName || messageData.deviceId) {
              const deviceInfo = messageData.deviceName || messageData.deviceId;
              message = `${deviceInfo} • ${message || messageData.eventType || 'Event received'}`;
            }

            // Display custom toast
            addToast({
              title,
              message,
              severity,
            });
          } catch (error) {
            console.error('[Alerts] Error parsing message:', error);
            const rawMessage = payload.toString();
            if (rawMessage && rawMessage.length > 0 && rawMessage.length < 200) {
              addToast({
                title: 'Event Notification',
                message: rawMessage,
                severity: 'info',
              });
            }
          }
        });

      } catch (error) {
        console.error('[Alerts] Failed to initialize MQTT client:', error);
        setConnectionStatus('error');
      }
    };

    connectMqtt();

    // Cleanup on unmount
    return () => {
      console.log('[Alerts] Cleaning up MQTT connection');
      if (clientRef.current) {
        try {
          clientRef.current.end(true);
          clientRef.current = null;
        } catch (error) {
          console.error('[Alerts] Error during cleanup:', error);
        }
      }
      isConnectedRef.current = false;
      setConnectionStatus('disconnected');
    };
  }, [
    editMode,
    id,
    meta.mqttTopic,
    meta.includeGlobalTopic,
    meta.eventFilter,
    meta.severityFilter,
    addToast,
  ]);

  // Safety check for parentComponent
  if (!parentComponent) {
    console.error('DashboardAlerts: Missing parentComponent', { id, parentId });
    return null;
  }

  const alertsLabel =
    meta.text && meta.text.length > 0 ? meta.text : t('Alert Listener');

  const isConfigured = meta.mqttTopic && meta.mqttTopic.trim().length > 0;

  const getStatusIcon = () => {
    if (!isConfigured) {
      // AlertOutlined isn't part of the antd icon set we wrap — use BellOutlined
      // (same icon used as the default in the connected/other cases below).
      return <Icons.BellOutlined className="alerts-icon" />;
    }
    
    switch (connectionStatus) {
      case 'connected':
        return <Icons.CheckCircleOutlined className="alerts-icon connected" />;
      case 'error':
        return <Icons.CloseCircleOutlined className="alerts-icon error" />;
      case 'connecting':
        return <Icons.LoadingOutlined className="alerts-icon" spin />;
      default:
        return <Icons.BellOutlined className="alerts-icon" />;
    }
  };

  const getStatusText = () => {
    if (!isConfigured) {
      return t('Click settings to configure topic');
    }
    
    switch (connectionStatus) {
      case 'connected':
        return t('Connected • Listening for events');
      case 'error':
        return t('Connection error');
      case 'connecting':
        return t('Connecting...');
      default:
        return t('Not connected');
    }
  };

  return (
    <Draggable
      component={component}
      parentComponent={parentComponent}
      orientation={parentComponent.type === ROW_TYPE ? 'column' : 'row'}
      index={index}
      depth={depth}
      onDrop={handleComponentDrop}
      disableDragDrop={isFocused}
      editMode={editMode}
    >
      {({ dragSourceRef }: { dragSourceRef?: (element: HTMLDivElement | null) => void }) => (
        <WithPopoverMenu
          isFocused={isFocused}
          onChangeFocus={updateFocus}
          editMode={editMode}
          menuItems={[]}
        >
          <AlertsStyles
            data-test="dashboard-alerts"
            className="dashboard-alerts"
            id={component.id}
          >
            <div
              ref={dragSourceRef}
              className="dashboard-component dashboard-component-chart-holder"
              data-test="dashboard-component-chart-holder"
            >
              {editMode && (
                <HoverMenu position="top">
                  <AlertsConfigMenuItem
                    meta={meta}
                    onSave={handleConfigSave}
                    onVisibilityChange={handleConfigVisibilityChange}
                  />
                  <DeleteComponentButton onDelete={handleDeleteComponent} />
                </HoverMenu>
              )}
              
              {getStatusIcon()}
              
              <div className="alerts-title">
                {editMode ? (
                  <EditableTitle
                    title={alertsLabel}
                    canEdit
                    onSaveTitle={handleChangeText}
                    showTooltip={false}
                  />
                ) : (
                  alertsLabel
                )}
              </div>
              
              {isConfigured && (
                <div className="alerts-topic" title={meta.mqttTopic}>
                  {meta.mqttTopic}
                </div>
              )}
            </div>
          </AlertsStyles>
        </WithPopoverMenu>
      )}
    </Draggable>
  );
};

export default DashboardAlerts;
