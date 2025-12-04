/**
 * AlertIcon - Header button to open alerts sidebar
 */
import React, { useState } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { useTheme } from '@apache-superset/core/ui';
import * as Icons from '@ant-design/icons';
import AlertsPanelComponent from './AlertsPanel';

const AlertIconButtonStyles = styled.button`
  ${({ theme }) => css`
    position: relative;
    background: none;
    border: none;
    padding: 8px;
    cursor: pointer;
    font-size: 18px;
    color: ${theme.colorText};
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: ${theme.borderRadius}px;
    transition: all 0.3s ease;
    margin-right: ${theme.sizeUnit}px;

    &:hover {
      background-color: ${theme.colorBgElevated};
      color: ${theme.colorPrimary};
    }

    .alert-badge {
      position: absolute;
      top: 0;
      right: 0;
      background-color: ${theme.colorError};
      color: white;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: bold;
      border: 2px solid ${theme.colorBgContainer};
    }
  `}
`;

const AlertIcon: React.FC = () => {
  const theme = useTheme();
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Dummy unread count - in real implementation, this would come from state/API
  const unreadCount = 2;

  return (
    <>
      <AlertIconButtonStyles
        theme={theme}
        onClick={() => setIsPanelOpen(true)}
        title="Open alerts"
      >
        <Icons.BellOutlined />
        {unreadCount > 0 && <span className="alert-badge">{unreadCount}</span>}
      </AlertIconButtonStyles>

      <AlertsPanelComponent isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} />
    </>
  );
};

export default AlertIcon;
