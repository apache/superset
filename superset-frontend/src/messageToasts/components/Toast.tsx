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
import React, { useEffect, useState } from 'react';
import Icon from 'src/components/Icon';
import { ToastType } from 'src/messageToasts/types';

import { SUCCESS_TOAST, WARNING_TOAST, DANGER_TOAST } from '../constants';

const ToastContianer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;

  span {
    padding: 0 11px;
  }
`;

interface ToastPresenterProps {
  toast: { id: string; toastType: ToastType; text: string; duration: number };
  onCloseToast: (id: string) => void;
}

export default function Toast({ toast, onCloseToast }: ToastPresenterProps) {
  let hideTimer: ReturnType<typeof setTimeout>;
  const [visible, setVisible] = useState(false);
  const showToast = () => {
    setVisible(true);
  };

  const handleClosePress = () => {
    clearTimeout(hideTimer);
    // Wait for the transition
    setVisible(() => {
      setTimeout(() => {
        onCloseToast(toast.id);
      }, 150);
      return false;
    });
  };

  useEffect(() => {
    setTimeout(showToast);

    if (toast.duration > 0) {
      hideTimer = setTimeout(handleClosePress, toast.duration);
    }
    return () => {
      clearTimeout(hideTimer);
    };
  }, []);

  return (
    <Alert
      onDismiss={handleClosePress}
      bsClass={cx(
        'alert',
        'toast',
        visible && 'toast--visible',
        toast.toastType === SUCCESS_TOAST && 'toast--success',
        toast.toastType === WARNING_TOAST && 'toast--warning',
        toast.toastType === DANGER_TOAST && 'toast--danger',
      )}
    >
      <ToastContianer>
        {toast.toastType === SUCCESS_TOAST && (
          <Icon name="circle-check-solid" />
        )}
        {toast.toastType === WARNING_TOAST ||
          (toast.toastType === DANGER_TOAST && <Icon name="error" />)}
        <Interweave content={toast.text} />
      </ToastContianer>
    </Alert>
  );
}
