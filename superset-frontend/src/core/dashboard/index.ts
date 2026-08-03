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

import type { dashboard as dashboardApi } from '@apache-superset/core';
import { provider, useDashboardRevision } from './store';
import { fetchQueryData } from './chartData';
import { registerBuiltInBuildingBlocks } from './registerBuiltInBuildingBlocks';

// Built-in block types (canvas/markdown/echarts) are registered the same
// way an extension registers its own — see registerBuiltInBuildingBlocks.
// Doing this here guarantees it happens before anything imports `dashboard`
// to render a node, regardless of which page or bridge triggers the import.
registerBuiltInBuildingBlocks();

export { useDashboardRevision };

export const dashboard: typeof dashboardApi = {
  getRoot: provider.getRoot,
  getNode: provider.getNode,
  addBuildingBlock: provider.addBuildingBlock.bind(provider),
  removeBuildingBlock: provider.removeBuildingBlock.bind(provider),
  moveBuildingBlock: provider.moveBuildingBlock.bind(provider),
  updateLayout: provider.updateLayout.bind(provider),
  updateProps: provider.updateProps.bind(provider),
  onDidLayoutChange: provider.onDidLayoutChange,
  fetchQueryData,
};
