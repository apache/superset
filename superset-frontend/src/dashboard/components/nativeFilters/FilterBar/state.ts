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
import { useDispatch, useSelector } from 'react-redux';
import { useCallback } from 'react';
import { ExtraFormData } from '@superset-ui/core';
import { setExtraFormData } from 'src/dashboard/actions/nativeFilters';
import { getInitialFilterState } from 'src/dashboard/reducers/nativeFilters';
import {
  CurrentFilterState,
  NativeFilterState,
  NativeFiltersState,
  FilterSets,
} from 'src/dashboard/reducers/types';
import { mergeExtraFormData } from '../utils';
import { Filter } from '../types';

export function useFilters() {
  return useSelector<any, Filter>(state => state.nativeFilters.filters);
}

export function useFiltersState() {
  return useSelector<any, NativeFilterState>(
    state => state.nativeFilters.filtersState,
  );
}

export function useFilterSets() {
  return useSelector<any, FilterSets>(
    state => state.nativeFilters.filterSets ?? {},
  );
}

export function useSetExtraFormData() {
  const dispatch = useDispatch();
  return useCallback(
    (
      id: string,
      extraFormData: ExtraFormData,
      currentState: CurrentFilterState,
    ) => dispatch(setExtraFormData(id, extraFormData, currentState)),
    [dispatch],
  );
}

export function useCascadingFilters(id: string) {
  const nativeFilters = useSelector<any, NativeFiltersState>(
    state => state.nativeFilters,
  );
  const { filters, filtersState } = nativeFilters;
  const filter = filters[id];
  const cascadeParentIds = filter?.cascadeParentIds ?? [];
  let cascadedFilters = {};
  cascadeParentIds.forEach(parentId => {
    const parentState = filtersState[parentId] || {};
    const { extraFormData: parentExtra = {} } = parentState;
    cascadedFilters = mergeExtraFormData(cascadedFilters, parentExtra);
  });
  return cascadedFilters;
}

export function useFilterState(id: string) {
  return useSelector<any, NativeFilterState>(
    state => state.nativeFilters.filtersState[id] || getInitialFilterState(id),
  );
}
