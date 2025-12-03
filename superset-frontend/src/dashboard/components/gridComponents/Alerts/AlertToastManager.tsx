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
import { styled, css } from '@apache-superset/core/ui';
import AlertToast from './AlertToast';

interface ToastData {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  severity: 'info' | 'success' | 'warning' | 'error';
}

interface AlertToastManagerProps {
  toasts: ToastData[];
  onRemoveToast: (id: string) => void;
}

const ToastManagerContainer = styled.div`
  ${({ theme }) => css`
    position: fixed;
    top: 70px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    pointer-events: none;
    max-height: calc(100vh - 90px);
    overflow: hidden;

    > * {
      pointer-events: auto;
    }
  `}
`;

export const AlertToastManager = ({
  toasts,
  onRemoveToast,
}: AlertToastManagerProps) => {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <ToastManagerContainer>
      {toasts.map(toast => (
        <AlertToast
          key={toast.id}
          id={toast.id}
          title={toast.title}
          message={toast.message}
          timestamp={toast.timestamp}
          severity={toast.severity}
          onClose={onRemoveToast}
          duration={5000}
        />
      ))}
    </ToastManagerContainer>
  );
};

export default AlertToastManager;
