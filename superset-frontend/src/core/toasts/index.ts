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

import type { toasts as toastsApi } from '@apache-superset/core';
import { logging } from '@apache-superset/core/utils';
import { openInNewTab } from 'src/utils/navigationUtils';
import { store } from 'src/views/store';
import {
  addToast,
  removeToast as removeToastAction,
} from 'src/components/MessageToasts/actions';
import { ToastType } from 'src/components/MessageToasts/types';

const DEFAULT_DURATION = 8000;

// Only `link` and `duration` are read, so HTML rendering and arbitrary callbacks stay unreachable.
const show = (
  toastType: ToastType,
  text: string,
  options?: toastsApi.ToastOptions,
): string => {
  const link = options?.link;
  const action = link
    ? {
        label: String(link.label),
        onClick: () => {
          try {
            openInNewTab(link.href);
          } catch (error) {
            logging.error('Refused to open toast link', link.href, error);
          }
        },
      }
    : undefined;
  const toast = addToast({
    toastType,
    text: String(text),
    duration: options?.duration ?? DEFAULT_DURATION,
    allowHtml: false,
    action,
  });
  store.dispatch(toast);
  return toast.payload.id;
};

export const toasts: typeof toastsApi = {
  addInfoToast: (text, options) => show(ToastType.Info, text, options),
  addSuccessToast: (text, options) => show(ToastType.Success, text, options),
  addWarningToast: (text, options) => show(ToastType.Warning, text, options),
  addDangerToast: (text, options) => show(ToastType.Danger, text, options),
  removeToast: id => {
    store.dispatch(removeToastAction(id));
  },
};
