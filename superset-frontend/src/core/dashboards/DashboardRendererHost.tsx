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
 * @fileoverview DashboardRendererHost component for dynamic dashboard
 * renderer resolution.
 *
 * This component resolves and renders the appropriate dashboard renderer
 * implementation. If an extension has registered a custom renderer (and the
 * dashboard is not in edit mode), it uses that; otherwise, it falls back to
 * the built-in dashboard renderer.
 */

import { useSyncExternalStore } from 'react';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import type { dashboards } from '@apache-superset/core';
import { ErrorBoundary } from 'src/components/ErrorBoundary';
import DefaultDashboardRenderer from 'src/dashboard/components/DashboardRenderer/DefaultDashboardRenderer';
import DashboardRendererProviders from './DashboardRendererProviders';

export interface DashboardRendererHostProps
  extends dashboards.DashboardRendererProps {
  /**
   * Host-only flag, not part of the renderer contract: when true, the
   * built-in renderer is always used. Custom renderers handle view mode
   * only — the built-in editor stack owns editing.
   */
  editMode?: boolean;
}

/**
 * DashboardRendererHost dynamically resolves and renders the appropriate
 * dashboard renderer.
 *
 * It checks whether an extension has registered a custom dashboard renderer
 * and uses that if available; otherwise, it falls back to the built-in
 * renderer. The built-in renderer is also used whenever the dashboard is in
 * edit mode, regardless of registration.
 */
const DashboardRendererHost = ({
  editMode,
  ...rendererProps
}: DashboardRendererHostProps) => {
  const manager = DashboardRendererProviders.getInstance();
  const provider = useSyncExternalStore(
    manager.subscribe,
    () => manager.getProvider(),
    () => undefined,
  );

  // Extensions can only register while the feature flag is on (the loader is
  // gated), but the dashboard blast radius warrants the extra check.
  const useCustomRenderer =
    !editMode &&
    provider !== undefined &&
    isFeatureEnabled(FeatureFlag.EnableExtensions);

  if (useCustomRenderer) {
    const RendererComponent = provider.component;
    return (
      <ErrorBoundary>
        <RendererComponent {...rendererProps} />
      </ErrorBoundary>
    );
  }

  return <DefaultDashboardRenderer {...rendererProps} />;
};

export default DashboardRendererHost;

export { DashboardRendererHost };
