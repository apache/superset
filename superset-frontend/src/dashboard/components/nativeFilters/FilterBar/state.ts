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
import { useSelector } from 'react-redux';
import { getInitialFilterState } from 'src/dashboard/reducers/nativeFilters';
import {
  NativeFiltersState,
  FilterState,
  FilterSets,
  FilterStates,
} from 'src/dashboard/reducers/types';
import { mergeExtraFormData } from '../utils';
import { Filter } from '../types';

export function useFilters() {
  return useSelector<any, Filter>(state => state.nativeFilters.filters);
}

export function useFiltersStateNative() {
  return useSelector<any, FilterStates>(
    state => state.nativeFilters.filtersState.nativeFilters ?? {},
  );
}

export function useFilterSets() {
  return useSelector<any, FilterSets>(
    state => state.nativeFilters.filterSets ?? {},
  );
}

export function useCascadingFilters(id: string) {
  const {
    filters,
    filtersState: { nativeFilters },
  } = useSelector<any, NativeFiltersState>(state => state.nativeFilters);
  const filter = filters[id];
  const cascadeParentIds: string[] = filter?.cascadeParentIds ?? [];
  let cascadedFilters = {};
  cascadeParentIds.forEach(parentId => {
    const parentState = nativeFilters[parentId] || {};
    const { extraFormData: parentExtra = {} } = parentState;
    cascadedFilters = {
      nativeFilters: mergeExtraFormData(cascadedFilters, parentExtra),
    };
  });
  return cascadedFilters;
}

export function useFilterStateNative(id: string) {
  return useSelector<any, FilterState>(
    state =>
      state.nativeFilters.filtersState.nativeFilters[id] ??
      getInitialFilterState(id),
  );
}
