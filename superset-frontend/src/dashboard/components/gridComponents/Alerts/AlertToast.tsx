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
import { useState, useEffect } from 'react';
import { styled, css } from '@apache-superset/core/ui';
import { Icons } from '@superset-ui/core/components/Icons';

interface AlertToastProps {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  onClose: (id: string) => void;
  duration?: number;
}

const ToastContainer = styled.div<{ severity: string; isExiting: boolean }>`
  ${({ theme, severity, isExiting }) => css`
    position: relative;
    min-width: 350px;
    max-width: 450px;
    background: ${theme.colorBgContainer};
    border-radius: ${theme.borderRadius}px;
    box-shadow: 0 6px 16px 0 rgba(0, 0, 0, 0.08),
                0 3px 6px -4px rgba(0, 0, 0, 0.12),
                0 9px 28px 8px rgba(0, 0, 0, 0.05);
    padding: ${theme.sizeUnit * 4}px;
    margin-bottom: ${theme.sizeUnit * 2}px;
    border-left: 4px solid ${
      severity === 'error'
        ? theme.colorError
        : severity === 'warning'
        ? theme.colorWarning
        : severity === 'success'
        ? theme.colorSuccess
        : theme.colorPrimary
    };
    animation: ${isExiting ? 'slideOut' : 'slideIn'} 0.3s ease-in-out;
    transition: all 0.3s ease;

    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }

    &:hover {
      box-shadow: 0 8px 20px 0 rgba(0, 0, 0, 0.12),
                  0 4px 8px -4px rgba(0, 0, 0, 0.16),
                  0 12px 32px 8px rgba(0, 0, 0, 0.08);
    }
  `}
`;

const ToastHeader = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: ${theme.sizeUnit * 2}px;
  `}
`;

const ToastTitle = styled.div`
  ${({ theme }) => css`
    font-size: ${theme.fontSizeLg}px;
    font-weight: ${theme.fontWeightBold};
    color: ${theme.colorText};
    flex: 1;
    line-height: 1.4;
  `}
`;

const CloseButton = styled.button`
  ${({ theme }) => css`
    background: none;
    border: none;
    color: ${theme.colorTextDescription};
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: ${theme.borderRadiusXs}px;
    transition: all 0.2s;

    &:hover {
      background-color: ${theme.colorBgLayout};
      color: ${theme.colorText};
    }

    svg {
      width: 14px;
      height: 14px;
    }
  `}
`;

const ToastMessage = styled.div`
  ${({ theme }) => css`
    font-size: ${theme.fontSizeBase}px;
    color: ${theme.colorTextSecondary};
    margin-bottom: ${theme.sizeUnit * 2}px;
    line-height: 1.6;
    word-break: break-word;
  `}
`;

const ToastTimestamp = styled.div`
  ${({ theme }) => css`
    font-size: ${theme.fontSizeSm}px;
    color: ${theme.colorTextDescription};
  `}
`;

export const AlertToast = ({
  id,
  title,
  message,
  timestamp,
  severity,
  onClose,
  duration = 5000,
}: AlertToastProps) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(id);
    }, 300); // Match animation duration
  };

  return (
    <ToastContainer severity={severity} isExiting={isExiting}>
      <ToastHeader>
        <ToastTitle>{title}</ToastTitle>
        <CloseButton onClick={handleClose} aria-label="Close notification">
          <Icons.CloseOutlined />
        </CloseButton>
      </ToastHeader>
      <ToastMessage>{message}</ToastMessage>
      <ToastTimestamp>{timestamp}</ToastTimestamp>
    </ToastContainer>
  );
};

export default AlertToast;
