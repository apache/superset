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
import { useMemo } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import {
  DataMaskStateWithId,
  ensureIsArray,
  ExtraFormData,
  Filter,
} from '@superset-ui/core';
import { mergeExtraFormData } from '../../utils';

type FilterConfigMap = Record<string, Pick<Filter, 'cascadeParentIds'>>;

/**
 * Resolve the full set of transitive ancestor filter ids for the given filter,
 * in topological order (furthest ancestor first, closest parent last).
 *
 * Dependent filters only list their *direct* parents in `cascadeParentIds`, but
 * the child filter's options and applied extra-form-data must reflect the full
 * chain of upstream filters. A chain A -> B -> C -> D where each level lists
 * only its direct parent used to compute C's options from B alone and D's
 * options from C alone; this meant the child filter's generated
 * `extra_form_data` did not include A's clause even though A is an effective
 * ancestor. That mismatch caused only a subset of filter values to land on
 * charts until the user pressed Apply a second time.
 *
 * Cycles are silently skipped; the filter-config modal enforces acyclicity at
 * save time, but we still defend against malformed config so that a bad entry
 * can never produce an infinite loop here.
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

/**
 * Resolve the transitive ancestor ids for a given filter from the live
 * native-filter configuration in Redux. Shared between
 * `useFilterDependencies` and the readiness guard in `FilterValue` so they
 * always agree on which parents count.
 */
export function useTransitiveParentIds(id: string): string[] {
  const filterConfig = useSelector<any, FilterConfigMap | undefined>(
    state => state.nativeFilters?.filters,
    shallowEqual,
  );

  return useMemo(
    () => resolveTransitiveParentIds(id, filterConfig ?? {}),
    [id, filterConfig],
  );
}

export function useFilterDependencies(
  id: string,
  dataMaskSelected?: DataMaskStateWithId,
): ExtraFormData {
  const dependencyIds = useTransitiveParentIds(id);

  return useMemo(() => {
    let dependencies: ExtraFormData = {};
    dependencyIds.forEach(parentId => {
      const parentState = dataMaskSelected?.[parentId];
      dependencies = mergeExtraFormData(
        dependencies,
        parentState?.extraFormData,
      );
    });
    return dependencies;
  }, [dataMaskSelected, dependencyIds]);
}
