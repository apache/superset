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

/**
 * @fileoverview Host implementation of the `dashboardComponents` contribution
 * type. Extensions register via `dashboardComponents.registerDashboardComponent()`
 * and the host renders contributed components inside its own dashboard chrome.
 *
 * The public namespace (`dashboardComponents`) is exposed to extensions on
 * `window.superset`. `useDashboardComponents` is host-internal and NOT part of
 * the public `@apache-superset/core` API.
 */

import { useSyncExternalStore } from 'react';
import type { dashboardComponents as api } from '@apache-superset/core';
import DashboardComponentsProvider from './DashboardComponentsProvider';

const provider = DashboardComponentsProvider.getInstance();

/**
 * Host-internal hook returning all registered dashboard components, re-rendering
 * when the set changes.
 */
export const useDashboardComponents = () =>
  useSyncExternalStore(provider.subscribe, provider.getDashboardComponents);

export const dashboardComponents: typeof api = {
  registerDashboardComponent: provider.registerDashboardComponent,
  getDashboardComponent: provider.getDashboardComponent,
  getDashboardComponents: provider.getDashboardComponents,
  onDidRegisterDashboardComponent: provider.onDidRegisterDashboardComponent,
  onDidUnregisterDashboardComponent: provider.onDidUnregisterDashboardComponent,
};
