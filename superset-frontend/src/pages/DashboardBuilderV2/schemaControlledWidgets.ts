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
 * Which widget types own a backend-served, schema-driven control panel —
 * derived from the backend registry, not hand-maintained here.
 *
 * The list is whatever `/api/v1/widgets/types` reports (the widget-controls
 * registry), fetched once and cached. Adding a widget type — built-in or from
 * an extension — therefore needs no edit to this file; the Inspector picks it
 * up automatically and falls back to the generic value-inferred `PropsForm` for
 * any type the backend has no schema for.
 *
 * Intentionally a tiny, dependency-free module (only `SupersetClient` +
 * `react`): the Inspector imports it eagerly to decide whether to render
 * `SchemaControlPanel` (lazily loaded). Keeping the JSONForms / `semanticLayers`
 * graph out of this module is what lets the Inspector stay in the eager bundle
 * without dragging that graph in (the core->features import cycle that
 * otherwise surfaces app-wide as `t is not a function`).
 */
import { useSyncExternalStore } from 'react';
import { SupersetClient } from '@superset-ui/core';

// `null` until the first fetch resolves; a Set of widget-type ids thereafter.
let types: ReadonlySet<string> | null = null;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach(listener => listener());

function ensureLoaded(): void {
  if (types !== null || inFlight) return;
  inFlight = SupersetClient.get({ endpoint: '/api/v1/widgets/types' })
    .then(({ json }) => {
      const result = (json as { result?: { id: string }[] }).result ?? [];
      types = new Set(result.map(entry => entry.id));
      emit();
    })
    .catch(() => {
      // Fail open: on error every widget is treated as having no schema, so the
      // Inspector shows the generic props form rather than hanging on Loading.
      types = new Set();
      emit();
    });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): ReadonlySet<string> | null => types;

/**
 * The set of widget types that have a backend-served control schema, fetched
 * once and cached. Returns `null` while the first fetch is in flight so callers
 * can show a loading state rather than momentarily rendering the wrong control.
 */
export function useSchemaControlledWidgetTypes(): ReadonlySet<string> | null {
  ensureLoaded();
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Reset the module-level cache. Test-only. */
export function resetSchemaControlledWidgetTypesForTests(): void {
  types = null;
  inFlight = null;
  listeners.clear();
}
