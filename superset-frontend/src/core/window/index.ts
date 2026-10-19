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

import type { window as windowApi } from '@apache-superset/core';
import {
  addDangerToast,
  addInfoToast,
  addWarningToast,
} from 'src/components/MessageToasts/actions';
import { store } from 'src/views/store';

/**
 * Only `duration` is part of the SDK contract, so pick it out rather than
 * forwarding the whole options object, and omit it when unset so the
 * host's per-severity default applies.
 */
const toToastOptions = (options?: windowApi.MessageOptions) =>
  options?.duration === undefined ? undefined : { duration: options.duration };

// Dispatched against the app-level `store` singleton directly, not via a
// `useDispatch()` hook, since these surfaces must also work from
// non-component extension code (e.g. a registered command's callback).
const showInformationMessage: typeof windowApi.showInformationMessage = (
  message,
  options,
) => {
  store.dispatch(addInfoToast(message, toToastOptions(options)));
};

const showWarningMessage: typeof windowApi.showWarningMessage = (
  message,
  options,
) => {
  store.dispatch(addWarningToast(message, toToastOptions(options)));
};

const showErrorMessage: typeof windowApi.showErrorMessage = (
  message,
  options,
) => {
  store.dispatch(addDangerToast(message, toToastOptions(options)));
};

export const window: typeof windowApi = {
  showInformationMessage,
  showWarningMessage,
  showErrorMessage,
};
