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
 * @fileoverview Boundary-wrapped renderers for SQL Lab left sidebar views.
 *
 * Each view's trigger and panel get their own ErrorBoundary, keyed by view
 * id, so a crashing panel cannot take down the icon strip, the view's own
 * icon, or any other view. The icon strip chrome itself (selection, sizing)
 * belongs to SQL Lab, not to core — SQL Lab composes these two components.
 */

import { type ComponentType, useRef } from 'react';
import { t } from '@apache-superset/core/translation';
import { logging } from '@apache-superset/core/utils';
import { css } from '@apache-superset/core/theme';
import { ErrorBoundary } from 'src/components/ErrorBoundary';
import ExtensionPlaceholder from 'src/extensions/ExtensionPlaceholder';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { store } from 'src/views/store';
import { useLeftBarView } from './leftBarViews';

/**
 * Returns an onError handler that logs and toasts once per view id, so a
 * crash-render-crash loop cannot spam the toast stack.
 */
function useCrashNotifier(viewId: string, viewName: string) {
  const notifiedFor = useRef<string | undefined>(undefined);
  return (error: Error) => {
    logging.error(`[sqlLab.leftBarViews] "${viewId}" crashed`, error);
    if (notifiedFor.current !== viewId) {
      notifiedFor.current = viewId;
      store.dispatch(
        addDangerToast(t('The %s widget failed to load.', viewName)),
      );
    }
  };
}

const ViewBoundary = ({
  component: Component,
  onError,
}: {
  component: ComponentType;
  onError: (error: Error) => void;
}) => (
  <ErrorBoundary showMessage={false} onError={onError}>
    <Component />
  </ErrorBoundary>
);

/**
 * Renders a single view's trigger, for use inside the sidebar's icon strip.
 * Renders nothing when the id is unregistered or the trigger crashes — an
 * icon slot is too small for an error message, and a missing icon degrades
 * more gracefully than a broken strip.
 */
export const LeftBarViewTriggerHost = ({ viewId }: { viewId: string }) => {
  const registration = useLeftBarView(viewId);
  const onError = useCrashNotifier(viewId, registration?.view.name ?? viewId);

  if (!registration) return null;

  return (
    <span data-test={`left-bar-view-trigger-${viewId}`}>
      <ViewBoundary
        key={`trigger-${viewId}`}
        component={registration.trigger}
        onError={onError}
      />
    </span>
  );
};

/**
 * Renders the selected view's panel, filling the sidebar content area. Falls
 * back to ExtensionPlaceholder for an unknown id — matching
 * `views.resolveView` — because that state means a manifest-declared view
 * failed to register.
 */
export const LeftBarViewPanelHost = ({ viewId }: { viewId: string }) => {
  const registration = useLeftBarView(viewId);
  const onError = useCrashNotifier(viewId, registration?.view.name ?? viewId);

  if (!registration) {
    return <ExtensionPlaceholder id={viewId} />;
  }

  return (
    <div
      data-test={`left-bar-view-panel-${viewId}`}
      css={css`
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        overflow: auto;
      `}
    >
      <ViewBoundary
        key={`panel-${viewId}`}
        component={registration.panel}
        onError={onError}
      />
    </div>
  );
};
