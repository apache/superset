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
import { ensureIsArray } from '@superset-ui/core';

/**
 * Shared graph primitives for the native-filter dependency graph.
 *
 * A dependent filter stores only its *direct* parents in `cascadeParentIds`,
 * but most consumers (options queries, `extra_form_data` emitted to charts,
 * readiness checks) need the full transitive ancestor set. Keeping the graph
 * primitives here lets the hook layer and any non-React callers (e.g. form
 * validation, batch checks) share one traversal implementation.
 */

/**
 * Minimal shape we need from the native-filter config map. Kept intentionally
 * narrow so dividers / chart customizations (which may omit `cascadeParentIds`)
 * are also assignable.
 */
export type FilterConfigMap = Record<string, { cascadeParentIds?: string[] }>;

/**
 * Resolve the full set of transitive ancestor filter ids for the given filter,
 * in topological order (furthest ancestor first, closest parent last).
 *
 * The ordering is significant: `mergeExtraFormData` appends filter arrays but
 * *overrides* scalar fields like `time_range`, so iterating ancestors from
 * furthest to closest makes the closest parent's scalar overrides win. A chain
 * A -> B -> C -> D where each level lists only its direct parent therefore
 * produces `[A, B, C]` for D, which matches the intended precedence.
 *
 * Cycles are silently skipped. The filter-config modal enforces acyclicity at
 * save time (see `hasCircularDependency`), but defensive traversal here keeps
 * a malformed saved config from spinning forever.
 */
export function resolveTransitiveParentIds(
  id: string,
  filterConfig: FilterConfigMap,
): string[] {
  const ordered: string[] = [];
  const visited = new Set<string>([id]);

  const visit = (currentId: string) => {
    const parents = ensureIsArray(
      filterConfig[currentId]?.cascadeParentIds,
    ) as string[];
    parents.forEach(parentId => {
      if (visited.has(parentId)) return;
      visited.add(parentId);
      // Depth-first so the furthest ancestors are appended before the
      // closer parents, giving a stable topological order.
      visit(parentId);
      ordered.push(parentId);
    });
  };

  visit(id);
  return ordered;
}
