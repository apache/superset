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
import { notification as antdNotification } from 'antd';
import { createContext, useContext, useMemo, ReactNode } from 'react';
import type { NotificationInstance } from 'antd/es/notification/interface';

export type NotificationType = 'success' | 'info' | 'warning' | 'error';

export type NotificationPlacement =
  | 'top'
  | 'topLeft'
  | 'topRight'
  | 'bottom'
  | 'bottomLeft'
  | 'bottomRight';

export interface NotificationArgsProps {
  message: ReactNode;
  description?: ReactNode;
  btn?: ReactNode;
  key?: string;
  onClose?: () => void;
  duration?: number | null;
  icon?: ReactNode;
  placement?: NotificationPlacement;
  className?: string;
  onClick?: () => void;
  closeIcon?: boolean | ReactNode;
  role?: 'alert' | 'status';
}

export type NotificationApi = NotificationInstance;

export interface NotificationContextType {
  api: NotificationApi;
  success: (args: NotificationArgsProps) => void;
  error: (args: NotificationArgsProps) => void;
  warning: (args: NotificationArgsProps) => void;
  info: (args: NotificationArgsProps) => void;
  open: (args: NotificationArgsProps & { type?: NotificationType }) => void;
  destroy: (key?: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [api, contextHolder] = antdNotification.useNotification();

  const value = useMemo<NotificationContextType>(
    () => ({
      api,
      success: args => api.success(args),
      error: args => api.error(args),
      warning: args => api.warning(args),
      info: args => api.info(args),
      open: args => api.open(args),
      destroy: (key?: string) => api.destroy(key),
    }),
    [api],
  );

  return (
    <NotificationContext.Provider value={value}>
      {contextHolder}
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      'useNotification must be used within a NotificationProvider',
    );
  }
  return context;
};
