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
import ResizableContainer from 'src/dashboard/components/resizable/ResizableContainer';
import { ROW_TYPE, COLUMN_TYPE } from 'src/dashboard/util/componentTypes';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import {
  GRID_MIN_COLUMN_COUNT,
  GRID_MIN_ROW_UNITS,
  GRID_BASE_UNIT,
} from 'src/dashboard/util/constants';
import type {
  LayoutItem,
  LayoutItemMeta,
} from 'src/dashboard/types';
import type {
  ResizeCallback,
  ResizeStartCallback,
} from 're-resizable';
import AlertsConfigMenuItem, {
  type AlertsConfig,
} from './AlertsConfigMenuItem';
import type { DashboardAlertsMeta, MqttMessage } from './types';

const AlertsStyles = styled.div`
  ${({ theme }) => css`
    &.dashboard-alerts {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      background-color: ${theme.colorBgContainer};
      border: 1px solid ${theme.colorBorder};
      border-radius: ${theme.borderRadius}px;
      min-height: ${GRID_BASE_UNIT * GRID_MIN_ROW_UNITS}px;

      /* Hide in view mode, only show in edit mode */
      .dashboard:not(.dashboard--editing) & {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
        min-height: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
        border: none !important;
        visibility: hidden;
        position: absolute;
      }

      .dashboard--editing & {
        cursor: move;
      }

      .dashboard-component-chart-holder {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: ${theme.sizeUnit * 3}px;
        min-height: ${GRID_BASE_UNIT * GRID_MIN_ROW_UNITS}px;
        gap: ${theme.sizeUnit * 2}px;
      }

      .alerts-icon {
        font-size: 32px;
        color: ${theme.colorPrimary};
        
        &.connected {
          color: ${theme.colorSuccess};
        }
        
        &.error {
          color: ${theme.colorError};
        }
      }

      .alerts-title {
        font-size: ${theme.fontSizeLg}px;
        font-weight: ${theme.fontWeightBold};
        color: ${theme.colorText};
        text-align: center;
      }

      .alerts-info {
        font-size: ${theme.fontSizeSm}px;
        color: ${theme.colorTextDescription};
        text-align: center;
        max-width: 300px;
      }

      .alerts-topic {
        font-size: ${theme.fontSizeSm}px;
        color: ${theme.colorTextSecondary};
        background-color: ${theme.colorBgElevated};
        padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
        border-radius: ${theme.borderRadiusXs}px;
        font-family: ${theme.fontFamilyCode};
        word-break: break-all;
      }

      .alerts-status {
        display: flex;
        align-items: center;
        gap: ${theme.sizeUnit}px;
        font-size: ${theme.fontSizeSm}px;
        color: ${theme.colorTextDescription};
        
        .status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: ${theme.colorTextDescription};
          
          &.connected {
            background-color: ${theme.colorSuccess};
            animation: pulse 2s infinite;
          }
          
          &.error {
            background-color: ${theme.colorError};
          }
        }
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
  availableColumnCount: number;
  columnWidth: number;
  onResizeStart: ResizeStartCallback;
  onResize: ResizeCallback;
  onResizeStop: ResizeCallback;
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
  availableColumnCount,
  columnWidth,
  onResizeStart,
  onResize,
  onResizeStop,
}: DashboardAlertsProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('disconnected');
  const { addInfoToast, addWarningToast, addDangerToast, addSuccessToast } = useToasts();
  
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
          } catch (error) {
            console.error('[Alerts] Error parsing message:', error);
            const rawMessage = payload.toString();
            if (rawMessage && rawMessage.length > 0 && rawMessage.length < 200) {
              addInfoToast(rawMessage);
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
    addInfoToast,
    addWarningToast,
    addDangerToast,
    addSuccessToast,
  ]);

  // Safety check for parentComponent
  if (!parentComponent) {
    console.error('DashboardAlerts: Missing parentComponent', { id, parentId });
    return null;
  }

  const widthMultiple =
    parentComponent.type === COLUMN_TYPE
      ? parentComponent.meta?.width || GRID_MIN_COLUMN_COUNT
      : component.meta?.width || GRID_MIN_COLUMN_COUNT;

  const heightMultiple =
    component.meta?.height && component.meta.height > 0
      ? component.meta.height
      : GRID_MIN_ROW_UNITS;

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
            <ResizableContainer
              id={component.id}
              adjustableWidth={parentComponent.type === ROW_TYPE}
              adjustableHeight
              widthStep={columnWidth}
              widthMultiple={widthMultiple}
              heightStep={GRID_BASE_UNIT}
              heightMultiple={heightMultiple}
              minWidthMultiple={GRID_MIN_COLUMN_COUNT}
              minHeightMultiple={GRID_MIN_ROW_UNITS}
              maxWidthMultiple={availableColumnCount + widthMultiple}
              onResizeStart={onResizeStart}
              onResize={onResize}
              onResizeStop={onResizeStop}
              editMode={isFocused ? false : editMode}
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
                  <div className="alerts-topic">
                    {meta.mqttTopic}
                  </div>
                )}
                
                <div className="alerts-info">
                  {getStatusText()}
                </div>

                {!editMode && isConfigured && (
                  <div className="alerts-status">
                    <div className={`status-indicator ${connectionStatus}`} />
                    <span>
                      {connectionStatus === 'connected' 
                        ? t('Active') 
                        : connectionStatus === 'connecting'
                        ? t('Connecting')
                        : connectionStatus === 'error'
                        ? t('Error')
                        : t('Disconnected')}
                    </span>
                  </div>
                )}
              </div>
            </ResizableContainer>
          </AlertsStyles>
        </WithPopoverMenu>
      )}
    </Draggable>
  );
};

export default DashboardAlerts;
