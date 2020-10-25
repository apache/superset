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
import { Alert } from 'react-bootstrap';
import { styled } from '@superset-ui/core';
import cx from 'classnames';
import Interweave from 'interweave';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Icon from 'src/components/Icon';
import { ToastType } from 'src/messageToasts/constants';
import { ToastMeta } from '../types';

const ToastContianer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;

  span {
    padding: 0 11px;
  }
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

  return (
    <Alert
      onDismiss={handleClosePress}
      bsClass={cx(
        'alert',
        'toast',
        visible && 'toast--visible',
        toast.toastType === ToastType.SUCCESS && 'toast--success',
        toast.toastType === ToastType.WARNING && 'toast--warning',
        toast.toastType === ToastType.DANGER && 'toast--danger',
      )}
    >
      <ToastContianer>
        {toast.toastType === ToastType.SUCCESS && (
          <Icon name="circle-check-solid" />
        )}
        {toast.toastType === ToastType.WARNING ||
          (toast.toastType === ToastType.DANGER && <Icon name="error-solid" />)}
        <Interweave content={toast.text} />
      </ToastContianer>
    </Alert>
  );
}
