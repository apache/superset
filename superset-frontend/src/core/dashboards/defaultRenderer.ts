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
 * @fileoverview Registers Superset's built-in dashboard renderer as the
 * default provider in the dashboard renderer registry.
 *
 * The built-in renderer goes through the same contribution point as
 * extension-contributed renderers: it occupies the default tier of the
 * slot, renders whenever no extension override is active (including when
 * the extensions feature flag is off), and is retrievable via the public
 * `dashboards.getDefaultDashboardRenderer()` so extensions can wrap it.
 *
 * The component is imported lazily so that bundles importing the
 * `dashboards` namespace (e.g. the app startup bundle) do not statically
 * pull in the dashboard rendering stack.
 */

import { lazy } from 'react';
import type { dashboards } from '@apache-superset/core';
import DashboardRendererProviders from './DashboardRendererProviders';

export const DEFAULT_DASHBOARD_RENDERER: dashboards.DashboardRenderer = {
  id: 'superset.dashboard-renderer',
  name: 'Superset Dashboard Renderer',
  description: "Superset's built-in dashboard renderer",
};

const DefaultDashboardRenderer = lazy(
  () =>
    import(
      /* webpackChunkName: "DefaultDashboardRenderer" */
      'src/dashboard/components/DashboardRenderer/DefaultDashboardRenderer'
    ),
);

DashboardRendererProviders.getInstance().setDefaultProvider(
  DEFAULT_DASHBOARD_RENDERER,
  DefaultDashboardRenderer,
);
