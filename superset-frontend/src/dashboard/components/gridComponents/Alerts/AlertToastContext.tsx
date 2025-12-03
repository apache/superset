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
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import AlertToastManager from './AlertToastManager';

interface ToastData {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  severity: 'info' | 'success' | 'warning' | 'error';
}

interface AlertToastContextType {
  addToast: (toast: Omit<ToastData, 'id' | 'timestamp'>) => void;
  removeToast: (id: string) => void;
}

const AlertToastContext = createContext<AlertToastContextType | undefined>(
  undefined,
);

export const useAlertToasts = () => {
  const context = useContext(AlertToastContext);
  if (!context) {
    throw new Error('useAlertToasts must be used within AlertToastProvider');
  }
  return context;
};

interface AlertToastProviderProps {
  children: ReactNode;
}

export const AlertToastProvider = ({ children }: AlertToastProviderProps) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((toast: Omit<ToastData, 'id' | 'timestamp'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toLocaleString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const newToast: ToastData = {
      id,
      timestamp,
      ...toast,
    };

    setToasts(prev => [...prev, newToast]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  return (
    <AlertToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <AlertToastManager toasts={toasts} onRemoveToast={removeToast} />
    </AlertToastContext.Provider>
  );
};

export default AlertToastContext;
