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
 * @fileoverview Host implementation of the `dashboard` contribution type
 * (prototype). Extensions/the AI agent call the public `dashboard.*` API
 * (`@apache-superset/core`) to place/move/resize/remove nodes; the host owns
 * the single in-memory node tree backing the "Dashboard v2" prototype page.
 *
 * The public namespace (`dashboard`) is exposed to extensions on
 * `window.superset`. `useDashboardRevision` is host-internal and NOT part of
 * the public `@apache-superset/core` API — it's how the prototype's own
 * canvas renderer knows to re-render, then walks the tree via the same
 * `getRoot`/`getNode` accessors extensions use.
 */

// Not `import type`: `dashboardApi.VALUE_CHANGED_EVENT` below needs the real
// runtime value the `@apache-superset/core` package compiles for that one
// `const` export (unlike the ambient `declare function`s alongside it, which
// this object exists to implement and have no JS output of their own).
import { dashboard as dashboardApi } from '@apache-superset/core';
import { store } from 'src/views/store';
import { provider, useDashboardRevision } from './store';
import { fetchQueryData } from './chartData';
import { registerBuiltInWidgets } from './registerBuiltInWidgets';
import { navigation } from '../navigation';

// Built-in widget types (canvas/markdown/echarts) are registered the same
// way an extension registers its own — see registerBuiltInWidgets.
// Doing this here guarantees it happens before anything imports `dashboard`
// to render a node, regardless of which page or bridge triggers the import.
registerBuiltInWidgets();

export { useDashboardRevision };

// The classic dashboard's id lives in the ordinary Redux store (populated
// when its own page mounts), not in `provider` — that class only ever knows
// about the separate, unpersisted "Dashboard v2" canvas tree. `dashboardInfo`
// itself is never reset on navigation (only ever merged/hydrated), so without
// the page check below, navigating away from a dashboard within the SPA
// (no full reload) would leave this returning the *previous* dashboard's id
// instead of "no dashboard active."
function getDashboardId(): number | undefined {
  if (navigation.getPage() !== 'dashboard') return undefined;
  return store.getState().dashboardInfo?.id;
}

export const dashboard: typeof dashboardApi = {
  getDashboardId,
  getRoot: provider.getRoot,
  getNode: provider.getNode,
  addWidget: provider.addWidget.bind(provider),
  removeWidget: provider.removeWidget.bind(provider),
  moveWidget: provider.moveWidget.bind(provider),
  updateLayout: provider.updateLayout.bind(provider),
  updateProps: provider.updateProps.bind(provider),
  onDidLayoutChange: provider.onDidLayoutChange,
  VALUE_CHANGED_EVENT: dashboardApi.VALUE_CHANGED_EVENT,
  emit: provider.emit,
  getValue: provider.getValue,
  on: provider.on,
  fetchQueryData,
};
