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
  slices: Record<string, Slice>,
  chartsInScope: number[],
): number[] {
  // all have been selected, always apply
  if (isGlobalScope(chartsInScope, slices)) {
    return Object.keys(slices).map(Number);
  }

  const chartsInScopeSet = new Set(chartsInScope);

  return Object.values(slices).reduce((result: number[], slice) => {
    if (chartsInScopeSet.has(slice.slice_id)) {
      result.push(slice.slice_id);
    }
    return result;
  }, []);
}
function getRelatedChartsForCrossFilter(
  filterKey: string,
  slices: Record<string, Slice>,
  scope: number[],
): number[] {
  const sourceSlice = slices[filterKey];

  if (!sourceSlice) return [];

  const fullScope = [
    ...scope.filter(s => String(s) !== filterKey),
    Number(filterKey),
  ];
  const scopeSet = new Set(scope);

  return Object.values(slices).reduce((result: number[], slice) => {
    if (slice.slice_id === Number(filterKey)) {
      return result;
    }
    // Check if it's in the global scope
    if (isGlobalScope(fullScope, slices)) {
      result.push(slice.slice_id);
      return result;
    }
    // Check if it's hand-picked in scope
    if (scopeSet.has(slice.slice_id)) {
      result.push(slice.slice_id);
    }
    return result;
  }, []);
}

export function getRelatedCharts(
  filterKey: string,
  filter: AppliedNativeFilterType | AppliedCrossFilterType | Filter,
  slices: Record<string, Slice>,
) {
  let related: number[] = [];
  const isCrossFilter =
    Object.keys(slices).includes(filterKey) && isAppliedCrossFilterType(filter);

  const chartsInScope = Array.isArray(filter.scope)
    ? filter.scope
    : (filter as Filter).chartsInScope ?? [];

  if (isCrossFilter) {
    related = getRelatedChartsForCrossFilter(filterKey, slices, chartsInScope);
  }

  const nativeFilter = filter as AppliedNativeFilterType | Filter;
  // on highlight, a standard native filter is passed
  // on apply, an applied native filter is passed
  if (
    !isCrossFilter ||
    isAppliedNativeFilterType(nativeFilter) ||
    isNativeFilter(nativeFilter)
  ) {
    related = getRelatedChartsForSelectFilter(slices, chartsInScope);
  }

  return related;
}
