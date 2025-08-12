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
import { styled, css, SupersetTheme, useTheme } from '@superset-ui/core';
import cx from 'classnames';
import { Interweave } from 'interweave';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icons } from '@superset-ui/core/components/Icons';
import { ToastType, ToastMeta } from './types';

const ToastContainer = styled.div`
  ${({ theme }) => css`
    display: flex;
    justify-content: space-between; // Changed from center to space-between
    align-items: center;

    // Content container for icon and text
    .toast__content {
      display: flex;
      align-items: center;
      flex: 1; // Take available space
    }

    .anticon {
      padding: 0 ${theme.sizeUnit}px;
    }

    .toast__close,
    .toast__close span {
      padding-left: ${theme.sizeUnit * 4}px;
    }
  `}
`;

const notificationStyledIcon = (theme: SupersetTheme) => css`
  min-width: ${theme.sizeUnit * 5}px;
  color: ${theme.colorTextLightSolid};
  margin-right: 0;
`;

interface ToastPresenterProps {
  toast: ToastMeta;
  onCloseToast: (id: string) => void;
}

export default function Toast({ toast, onCloseToast }: ToastPresenterProps) {
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const [visible, setVisible] = useState(false);

  const showToast = () => {
    setVisible(true);
  };

  const handleClosePress = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
    }
    // Wait for the transition
    setVisible(() => {
      setTimeout(() => {
        onCloseToast(toast.id);
      }, 150);
      return false;
    });
  }, [onCloseToast, toast.id]);

  useEffect(() => {
    setTimeout(showToast);
    if (toast.duration > 0) {
      hideTimer.current = setTimeout(handleClosePress, toast.duration);
    }
    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
    };
  }, [handleClosePress, toast.duration]);

  const theme = useTheme();
  let className = 'toast--success';
  let icon = (
    <Icons.CheckCircleFilled
      css={theme => notificationStyledIcon(theme)}
      iconColor={theme.colorSuccess}
    />
  );

  if (toast.toastType === ToastType.Warning) {
    icon = (
      <Icons.ExclamationCircleFilled
        css={notificationStyledIcon}
        iconColor={theme.colorWarning}
      />
    );
    className = 'toast--warning';
  } else if (toast.toastType === ToastType.Danger) {
    icon = (
      <Icons.ExclamationCircleFilled
        css={notificationStyledIcon}
        iconColor={theme.colorError}
      />
    );
    className = 'toast--danger';
  } else if (toast.toastType === ToastType.Info) {
    icon = (
      <Icons.InfoCircleFilled
        css={notificationStyledIcon}
        iconColor={theme.colorInfo}
      />
    );
    className = 'toast--info';
  }

  return (
    <ToastContainer
      className={cx('alert', 'toast', visible && 'toast--visible', className)}
      data-test="toast-container"
      role="alert"
    >
      <div className="toast__content">
        {icon}
        <Interweave content={toast.text} noHtml={!toast.allowHtml} />
      </div>
      <Icons.CloseOutlined
        iconSize="m"
        className="toast__close pointer"
        role="button"
        tabIndex={0}
        onClick={handleClosePress}
        aria-label="Close"
        data-test="close-button"
      />
    </ToastContainer>
  );
}
