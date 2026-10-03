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
 * Backend query-context generation entry (Apache Superset #33615).
 *
 * The mapping `form_data -> query_context` lives in each viz plugin's JS
 * `buildQuery` (there is no server-side equivalent), so a faithful backend
 * synthesis must run the SAME code the frontend runs. This entry imports the
 * plugins' pure `buildQuery` functions DIRECTLY (never the plugin index, which
 * pulls React/DOM), builds a `viz_type -> buildQuery` registry, and exposes a
 * single JSON-in/JSON-out `generateQueryContext` callable. It is bundled by
 * `scripts/build-backend-querycontext.mjs` into a self-contained IIFE that a
 * bare V8 (py_mini_racer, on the Python backend) evaluates and calls.
 *
 * COVERAGE: the `viz_type -> buildQuery` map is code-generated from the plugin
 * registrations (MainPreset `.configure({ key })` joined to each package's default
 * `buildQuery`) by `scripts/gen-qc-registry.mjs` -> `registry.generated.ts`. Re-run
 * that script when plugins change. Viz types with no `buildQuery` (markup, handlebars
 * static, deck.gl static, cartodiagram, ...) are intentionally absent and correctly
 * non-derivable: the Python caller then falls back to the pure generic derivation or
 * leaves query_context NULL.
 */

// Generated viz_type -> buildQuery map (imports each plugin's DOM-free default
// buildQuery by source path). Regenerate via `node scripts/gen-qc-registry.mjs`.
import { REGISTRY, VIZ_TYPES } from './registry.generated';

export { VIZ_TYPES };

/**
 * @param vizType     the chart's viz_type
 * @param formDataJson JSON string of the chart's form_data (params)
 * @returns JSON string: the query_context, OR `{__unsupported__:true,...}` when
 *          the viz_type is not registered, OR `{__error__:"..."}` on failure.
 *          Never throws — the Python caller falls back on any sentinel.
 */
export function generateQueryContext(
  vizType: string,
  formDataJson: string,
): string {
  try {
    const fn = REGISTRY[vizType];
    if (!fn) {
      return JSON.stringify({ __unsupported__: true, viz_type: vizType });
    }
    const formData = JSON.parse(formDataJson);
    const queryContext = fn(formData);
    return JSON.stringify(queryContext);
  } catch (e) {
    return JSON.stringify({
      __error__: String((e && (e as Error).stack) || e),
    });
  }
}

// Expose on the global object so a bare V8 (no module system) can invoke it by
// name after evaluating the IIFE bundle.
(globalThis as any).generateQueryContext = generateQueryContext;
(globalThis as any).SUPERSET_QC_VIZ_TYPES = VIZ_TYPES;

export default generateQueryContext;
