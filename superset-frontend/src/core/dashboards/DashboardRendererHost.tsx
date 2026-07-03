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
 * This component resolves and renders the active dashboard renderer from
 * the provider registry. Superset's built-in renderer is registered as the
 * default provider (see ./defaultRenderer), so dashboards always render:
 * an extension-registered override wins in view mode when the extensions
 * feature flag is on; the built-in default renders otherwise — including
 * in edit mode and when the flag is off.
 */

import { Suspense, useSyncExternalStore } from 'react';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import type { dashboards } from '@apache-superset/core';
import { Loading } from '@superset-ui/core/components';
import { ErrorBoundary } from 'src/components/ErrorBoundary';
import DashboardRendererProviders from './DashboardRendererProviders';
// Registers the built-in renderer as the default provider (side effect)
import './defaultRenderer';

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
 * and uses that if available; otherwise, it renders the built-in default
 * provider. The built-in renderer is also used whenever the dashboard is in
 * edit mode, regardless of registration.
 */
const DashboardRendererHost = ({
  editMode,
  ...rendererProps
}: DashboardRendererHostProps) => {
  const manager = DashboardRendererProviders.getInstance();
  const override = useSyncExternalStore(
    manager.subscribe,
    () => manager.getOverrideProvider(),
    () => undefined,
  );

  // Extensions can only register while the feature flag is on (the loader is
  // gated), but the dashboard blast radius warrants the extra check.
  const useOverride =
    !editMode &&
    override !== undefined &&
    isFeatureEnabled(FeatureFlag.EnableExtensions);

  if (useOverride) {
    const RendererComponent = override.component;
    return (
      <ErrorBoundary>
        <RendererComponent {...rendererProps} />
      </ErrorBoundary>
    );
  }

  const defaultProvider = manager.getDefaultProvider();
  if (!defaultProvider) {
    return null;
  }
  const DefaultRenderer = defaultProvider.component;
  return (
    <Suspense fallback={<Loading />}>
      <DefaultRenderer {...rendererProps} />
    </Suspense>
  );
};

export default DashboardRendererHost;

export { DashboardRendererHost };
