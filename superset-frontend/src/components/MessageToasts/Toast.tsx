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
import { styled, css, SupersetTheme } from '@superset-ui/core';
import cx from 'classnames';
import Interweave from 'interweave';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Icons from 'src/components/Icons';
import { ToastType, ToastMeta } from './types';

const ToastContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;

  span {
    padding: 0 11px;
  }
`;

const StyledIcon = (theme: SupersetTheme) => css`
  min-width: ${theme.gridUnit * 5}px;
  color: ${theme.colors.grayscale.base};
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

  let className = 'toast--success';
  let icon = <Icons.CircleCheckSolid css={theme => StyledIcon(theme)} />;

  if (toast.toastType === ToastType.WARNING) {
    icon = <Icons.WarningSolid css={StyledIcon} />;
    className = 'toast--warning';
  } else if (toast.toastType === ToastType.DANGER) {
    icon = <Icons.ErrorSolid css={StyledIcon} />;
    className = 'toast--danger';
  } else if (toast.toastType === ToastType.INFO) {
    icon = <Icons.InfoSolid css={StyledIcon} />;
    className = 'toast--info';
  }

  return (
    <ToastContainer
      className={cx('alert', 'toast', visible && 'toast--visible', className)}
      data-test="toast-container"
      role="alert"
    >
      {icon}
      <Interweave content={toast.text} />
      <i
        className="fa fa-close pull-right pointer"
        role="button"
        tabIndex={0}
        onClick={handleClosePress}
        aria-label="Close"
        data-test="close-button"
      />
    </ToastContainer>
  );
}
