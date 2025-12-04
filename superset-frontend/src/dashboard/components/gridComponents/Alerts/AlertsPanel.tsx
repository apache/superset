/**
 * AlertsPanel - Sidebar modal showing dummy alerts list
 */
import React, { useState } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import * as Icons from '@ant-design/icons';
import { Empty } from 'antd';
import { useTheme } from '@apache-superset/core/ui';

// Dummy alerts data
const DUMMY_ALERTS = [
  {
    id: 1,
    title: 'High Temperature Alert',
    message: 'Device TEMP-001 exceeded threshold of 45°C',
    timestamp: new Date(Date.now() - 5 * 60000),
    severity: 'error' as const,
    read: false,
  },
  {
    id: 2,
    title: 'Device Offline',
    message: 'Device DEVICE-005 is offline',
    timestamp: new Date(Date.now() - 15 * 60000),
    severity: 'warning' as const,
    read: false,
  },
  {
    id: 3,
    title: 'Threshold Reached',
    message: 'Pressure reading at 98% of maximum',
    timestamp: new Date(Date.now() - 1 * 60 * 60000),
    severity: 'warning' as const,
    read: true,
  },
  {
    id: 4,
    title: 'Connection Restored',
    message: 'Device DEVICE-003 is back online',
    timestamp: new Date(Date.now() - 2 * 60 * 60000),
    severity: 'success' as const,
    read: true,
  },
  {
    id: 5,
    title: 'Low Battery',
    message: 'Battery level at 15% for sensor SENSOR-002',
    timestamp: new Date(Date.now() - 3 * 60 * 60000),
    severity: 'error' as const,
    read: true,
  },
];

interface Alert {
  id: number;
  title: string;
  message: string;
  timestamp: Date;
  severity: 'error' | 'warning' | 'success' | 'info';
  read: boolean;
}

const PanelStyles = styled.div`
  ${({ theme }) => css`
    position: fixed;
    top: 0;
    right: 0;
    width: 400px;
    height: 100vh;
    background-color: ${theme.colorBgContainer};
    border-left: 1px solid ${theme.colorBorder};
    box-shadow: -4px 0 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    animation: slideIn 0.3s ease-out;

    @keyframes slideIn {
      from {
        transform: translateX(100%);
      }
      to {
        transform: translateX(0);
      }
    }

    .alerts-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: ${theme.sizeUnit * 3}px;
      border-bottom: 1px solid ${theme.colorBorder};
      background-color: ${theme.colorBgElevated};

      .alerts-panel-title {
        font-size: ${theme.fontSizeLG}px;
        font-weight: 700;
        color: ${theme.colorText};
        margin: 0;
        display: flex;
        align-items: center;
        gap: ${theme.sizeUnit}px;

        .alert-badge {
          background-color: ${theme.colorError};
          color: white;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${theme.fontSizeXS}px;
          font-weight: 700;
        }
      }

      .close-button {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: ${theme.colorText};
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;

        &:hover {
          color: ${theme.colorPrimary};
        }
      }
    }

    .alerts-panel-content {
      flex: 1;
      overflow-y: auto;
      padding: ${theme.sizeUnit * 2}px;

      &::-webkit-scrollbar {
        width: 6px;
      }

      &::-webkit-scrollbar-track {
        background: transparent;
      }

      &::-webkit-scrollbar-thumb {
        background: ${theme.colorBorder};
        border-radius: 3px;

        &:hover {
          background: ${theme.colorTextSecondary};
        }
      }
    }

    .alerts-panel-footer {
      padding: ${theme.sizeUnit * 2}px;
      border-top: 1px solid ${theme.colorBorder};
      display: flex;
      gap: ${theme.sizeUnit}px;

      button {
        flex: 1;
      }
    }
  `}
`;

const AlertItemStyles = styled.div<{ severity: 'error' | 'warning' | 'success' | 'info'; read: boolean }>`
  ${({ theme, severity, read }) => {
    const severityColors: Record<'error' | 'warning' | 'success' | 'info', string> = {
      error: theme.colorError,
      warning: theme.colorWarning,
      success: theme.colorSuccess,
      info: theme.colorInfo,
    };

    return css`
      padding: ${theme.sizeUnit * 2}px;
      border-left: 4px solid ${severityColors[severity] || theme.colorPrimary};
      border-radius: ${theme.borderRadiusXS}px;
      background-color: ${read ? 'transparent' : theme.colorBgElevated};
      margin-bottom: ${theme.sizeUnit}px;
      cursor: pointer;
      transition: all 0.3s ease;

      &:hover {
        background-color: ${theme.colorBgElevated};
      }

      .alert-item-header {
        display: flex;
        align-items: flex-start;
        gap: ${theme.sizeUnit}px;
        margin-bottom: ${theme.sizeUnit}px;

        .alert-icon {
          font-size: 16px;
          color: ${severityColors[severity] || theme.colorPrimary};
          flex-shrink: 0;
          margin-top: 2px;
        }

        .alert-title-section {
          flex: 1;
          min-width: 0;

          .alert-title {
            font-size: ${theme.fontSize}px;
            font-weight: ${read ? '400' : '700'};
            color: ${theme.colorText};
            margin: 0;
          }

          .alert-time {
            font-size: ${theme.fontSizeXS}px;
            color: ${theme.colorTextSecondary};
            margin: ${theme.sizeUnit * 0.5}px 0 0 0;
          }
        }

        .alert-unread-badge {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: ${theme.colorError};
          flex-shrink: 0;
          margin-top: 6px;
        }
      }

      .alert-message {
        font-size: ${theme.fontSizeSM}px;
        color: ${theme.colorTextSecondary};
        line-height: 1.5;
        margin: 0;
        margin-left: ${16 + theme.sizeUnit}px;
      }
    `;
  }}
`;

interface AlertsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const AlertsPanelComponent: React.FC<AlertsPanelProps> = ({ isOpen, onClose }) => {
  const theme = useTheme();
  const [alerts, setAlerts] = useState<Alert[]>(DUMMY_ALERTS);

  const unreadCount = alerts.filter(a => !a.read).length;

  const handleMarkAllAsRead = () => {
    setAlerts(alerts.map(alert => ({ ...alert, read: true })));
  };

  const handleClearAll = () => {
    setAlerts([]);
  };

  const handleAlertClick = (id: number) => {
    setAlerts(alerts.map(alert => 
      alert.id === id ? { ...alert, read: true } : alert
    ));
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <Icons.ExclamationCircleOutlined />;
      case 'warning':
        return <Icons.WarningOutlined />;
      case 'success':
        return <Icons.CheckCircleOutlined />;
      case 'info':
        return <Icons.InfoCircleOutlined />;
      default:
        return <Icons.BellOutlined />;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          zIndex: 999,
          animation: 'fadeIn 0.3s ease-out',
        }}
      />

      {/* Panel */}
      <PanelStyles theme={theme}>
        <div className="alerts-panel-header">
          <h2 className="alerts-panel-title">
            <Icons.BellOutlined />
            Alerts
            {unreadCount > 0 && <span className="alert-badge">{unreadCount}</span>}
          </h2>
          <button className="close-button" onClick={onClose}>
            <Icons.CloseOutlined />
          </button>
        </div>

        <div className="alerts-panel-content">
          {alerts.length === 0 ? (
            <Empty description="No alerts" style={{ marginTop: '40px' }} />
          ) : (
            alerts.map(alert => (
              <AlertItemStyles
                key={alert.id}
                severity={alert.severity}
                read={alert.read}
                onClick={() => handleAlertClick(alert.id)}
                theme={theme}
              >
                <div className="alert-item-header">
                  <div className="alert-icon">{getSeverityIcon(alert.severity)}</div>
                  <div className="alert-title-section">
                    <h3 className="alert-title">{alert.title}</h3>
                    <p className="alert-time">{formatTime(alert.timestamp)}</p>
                  </div>
                  {!alert.read && <div className="alert-unread-badge" />}
                </div>
                <p className="alert-message">{alert.message}</p>
              </AlertItemStyles>
            ))
          )}
        </div>

        {alerts.length > 0 && (
          <div className="alerts-panel-footer">
            <button 
              onClick={handleMarkAllAsRead}
              style={{
                background: 'none',
                border: 'none',
                color: theme.colorPrimary,
                cursor: 'pointer',
                padding: '8px 16px',
                flex: 1,
                fontSize: theme.fontSize,
              }}
            >
              Mark all as read
            </button>
            <button 
              onClick={handleClearAll}
              style={{
                background: 'none',
                border: 'none',
                color: theme.colorError,
                cursor: 'pointer',
                padding: '8px 16px',
                flex: 1,
                fontSize: theme.fontSize,
              }}
            >
              Clear all
            </button>
          </div>
        )}
      </PanelStyles>
    </>
  );
};

export default AlertsPanelComponent;
