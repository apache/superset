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
 * Which widget types own a backend-served, schema-driven control panel.
 *
 * Intentionally a tiny, dependency-free module: the Inspector imports it
 * eagerly to decide whether to render `SchemaControlPanel` (lazily loaded)
 * instead of the generic value-inferred `PropsForm`. Keeping the JSONForms /
 * `semanticLayers` graph out of this module is what lets the Inspector stay in
 * the eager bundle without dragging that graph into it (the core->features
 * import cycle that otherwise surfaces app-wide as `t is not a function`).
 *
 * A widget listed here must have a matching backend control set registered in
 * `superset/widgets/widgets.py`.
 */
export const SCHEMA_CONTROLLED_WIDGET_TYPES: ReadonlySet<string> = new Set([
  'balloons',
  'metric-tile',
  'ag-grid-table',
]);
