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
import { useEffect, useRef } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { Interweave } from 'interweave';
import { useNotification } from './NotificationProvider';
import { removeToast } from './actions';
import { ToastMeta, ToastType } from './types';

interface ToastContainerProps {
  toasts: ToastMeta[];
  removeToast: (id: string) => void;
}

function ToastPresenter({ toasts, removeToast }: ToastContainerProps) {
  const notification = useNotification();
  const toastKeyMap = useRef(new Map<string, string>());
  const displayedToasts = useRef(new Set<string>());

  useEffect(() => {
    // Process new toasts
    toasts.forEach(toast => {
      if (!displayedToasts.current.has(toast.id)) {
        displayedToasts.current.add(toast.id);
        
        const notificationKey = `toast-${toast.id}`;
        toastKeyMap.current.set(toast.id, notificationKey);

        const message = toast.allowHtml ? (
          <Interweave content={toast.text} />
        ) : (
          toast.text
        );

        const config = {
          key: notificationKey,
          message,
          duration: toast.duration > 0 ? toast.duration / 1000 : 0,
          placement: 'bottomRight' as const,
          onClose: () => {
            toastKeyMap.current.delete(toast.id);
            displayedToasts.current.delete(toast.id);
            removeToast(toast.id);
          },
        };

        switch (toast.toastType) {
          case ToastType.Success:
            notification.success(config);
            break;
          case ToastType.Warning:
            notification.warning(config);
            break;
          case ToastType.Danger:
            notification.error(config);
            break;
          case ToastType.Info:
          default:
            notification.info(config);
            break;
        }
      }
    });

    // Clean up removed toasts
    const currentToastIds = new Set(toasts.map(t => t.id));
    displayedToasts.current.forEach(id => {
      if (!currentToastIds.has(id)) {
        const key = toastKeyMap.current.get(id);
        if (key) {
          notification.destroy(key);
          toastKeyMap.current.delete(id);
        }
        displayedToasts.current.delete(id);
      }
    });
  }, [toasts, removeToast, notification]);

  return null;
}

const ToastContainer = connect(
  ({ messageToasts: toasts }: any) => ({ toasts }),
  dispatch => bindActionCreators({ removeToast }, dispatch),
)(ToastPresenter);

export default ToastContainer;