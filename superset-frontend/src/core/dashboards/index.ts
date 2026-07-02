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
 * @fileoverview Host implementation of the `dashboards` contribution type.
 *
 * Extensions register via the public `dashboards.registerDashboardRenderer()`
 * and the host resolves the active provider, falling back to the built-in
 * dashboard renderer when no extension is registered.
 *
 * The public namespace (`dashboards`) is exposed to extensions on
 * `window.superset`. `DashboardRendererHost` is the host-internal component
 * for rendering dashboards and is NOT part of the public
 * `@apache-superset/core` API.
 */

import { useSyncExternalStore } from 'react';
import { dashboards as dashboardsApi } from '@apache-superset/core';
import DashboardRendererProviders from './DashboardRendererProviders';

export type { DashboardRendererHostProps } from './DashboardRendererHost';
export { default as DashboardRendererHost } from './DashboardRendererHost';

const provider = DashboardRendererProviders.getInstance();

export const useDashboardRenderer = () =>
  useSyncExternalStore(
    provider.subscribe,
    () => provider.getProvider(),
    () => undefined,
  );

export const dashboards: typeof dashboardsApi = {
  registerDashboardRenderer: provider.registerProvider.bind(provider),
  getDashboardRenderer: provider.getProvider.bind(provider),
  onDidRegisterDashboardRenderer: provider.onDidRegister.bind(provider),
  onDidUnregisterDashboardRenderer: provider.onDidUnregister.bind(provider),
};
