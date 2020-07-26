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
import React from 'react';
import styled from '@superset-ui/style';
import { ToastType } from 'src/messageToasts/types';
import Toast from './Toast';

const StyledToastPresenter = styled.div`
  max-width: 600px;
  position: fixed;
  bottom: 0px;
  right: -110px;
  transform: translate(-50%, 0);
  z-index: ${({ theme }) => theme.zIndex.max};

  .toast {
    background: ${({ theme }) => theme.colors.grayscale.dark1};
    border-radius: ${({ theme }) => theme.borderRadius};
    box-shadow: 0 2px 4px 0
      fade(
        ${({ theme }) => theme.colors.grayscale.dark2},
        ${({ theme }) => theme.opacity.mediumLight}
      );
    color: ${({ theme }) => theme.colors.grayscale.light5};
    opacity: 0;
    position: relative;
    transform: translateY(-100%);
    white-space: pre-line;
    will-change: transform, opacity;
    transition: transform ${({ theme }) => theme.transitionTiming}s,
      opacity ${({ theme }) => theme.transitionTiming}s;

    &:after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 6px;
      height: 100%;
    }
  }

  .toast > button {
    color: ${({ theme }) => theme.colors.grayscale.light5};
    opacity: 1;
  }

  .toast--visible {
    opacity: 1;
    transform: translateY(0);
  }
`;

type ToastShape = {
  id: string;
  toastType: ToastType;
  text: string;
  duration: number;
};

interface ToastPresenterProps {
  toasts: Array<ToastShape>;
  removeToast: () => void;
}

const ToastPresenter = ({ toasts, removeToast }: ToastPresenterProps) =>
  toasts.length > 0 && (
    <StyledToastPresenter id="toast-presenter">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onCloseToast={removeToast} />
      ))}
    </StyledToastPresenter>
  );

export default ToastPresenter;
