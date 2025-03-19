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

import {
  AppliedCrossFilterType,
  AppliedNativeFilterType,
  Filter,
  isAppliedCrossFilterType,
  isAppliedNativeFilterType,
  isNativeFilter,
} from '@superset-ui/core';
import { Slice } from 'src/types/Chart';

function isGlobalScope(scope: number[], slices: Record<string, Slice>) {
  return scope.length === Object.keys(slices).length;
}

function getRelatedChartsForSelectFilter(
  nativeFilter: AppliedNativeFilterType | Filter,
  slices: Record<string, Slice>,
  chartsInScope: number[],
) {
  return Object.values(slices)
    .filter(slice => {
      const { slice_id } = slice;
      // all have been selected, always apply
      if (isGlobalScope(chartsInScope, slices)) return true;
      // hand-picked in scope, always apply
      if (chartsInScope.includes(slice_id)) return true;

      return false;
    })
    .map(slice => slice.slice_id);
}
function getRelatedChartsForCrossFilter(
  filterKey: string,
  crossFilter: AppliedCrossFilterType,
  slices: Record<string, Slice>,
  scope: number[],
): number[] {
  const sourceSlice = slices[filterKey];

  if (!sourceSlice) return [];

  return Object.values(slices)
    .filter(slice => {
      // cross-filter emitter
      if (slice.slice_id === Number(filterKey)) return false;
      // hand-picked in the scope, always apply
      const fullScope = [
        ...scope.filter(s => String(s) !== filterKey),
        Number(filterKey),
      ];
      if (isGlobalScope(fullScope, slices)) return true;
      // hand-picked in the scope, always apply
      if (scope.includes(slice.slice_id)) return true;

      return false;
    })
    .map(slice => slice.slice_id);
}

export function getRelatedCharts(
  filters: Record<
    string,
    AppliedNativeFilterType | AppliedCrossFilterType | Filter
  >,
  checkFilters: Record<
    string,
    AppliedNativeFilterType | AppliedCrossFilterType | Filter
  > | null,
  slices: Record<string, Slice>,
) {
  const related = Object.entries(filters).reduce((acc, [filterKey, filter]) => {
    const isCrossFilter =
      Object.keys(slices).includes(filterKey) &&
      isAppliedCrossFilterType(filter);

    const chartsInScope = Array.isArray(filter.scope)
      ? filter.scope
      : (filter as Filter).chartsInScope ?? [];

    if (isCrossFilter) {
      const checkFilter = checkFilters?.[filterKey] as AppliedCrossFilterType;
      const crossFilter = filter as AppliedCrossFilterType;
      const wasRemoved = !!(
        ((filter.values && filter.values.filters === undefined) ||
          filter.values?.filters?.length === 0) &&
        checkFilter?.values?.filters?.length
      );
      const actualCrossFilter = wasRemoved ? checkFilter : crossFilter;

      return {
        ...acc,
        [filterKey]: getRelatedChartsForCrossFilter(
          filterKey,
          actualCrossFilter,
          slices,
          chartsInScope,
        ),
      };
    }

    const nativeFilter = filter as AppliedNativeFilterType | Filter;
    // on highlight, a standard native filter is passed
    // on apply, an applied native filter is passed
    if (
      isAppliedNativeFilterType(nativeFilter) ||
      isNativeFilter(nativeFilter)
    ) {
      return {
        ...acc,
        [filterKey]: getRelatedChartsForSelectFilter(
          nativeFilter,
          slices,
          chartsInScope,
        ),
      };
    }
    return {
      ...acc,
      [filterKey]: chartsInScope,
    };
  }, {});

  return related;
}
