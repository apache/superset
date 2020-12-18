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
import { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setExtraFormData } from 'src/dashboard/actions/nativeFilters';
import { getInitialFilterState } from 'src/dashboard/reducers/nativeFilters';
import { ExtraFormData, t } from '@superset-ui/core';
import { Charts, Layout, RootState } from 'src/dashboard/types';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { DASHBOARD_ROOT_TYPE } from 'src/dashboard/util/componentTypes';
import {
  Filter,
  FilterConfiguration,
  FilterState,
  NativeFiltersState,
  TreeItem,
} from './types';
import { buildTree, mergeExtraFormData } from './utils';

const defaultFilterConfiguration: Filter[] = [];

export function useFilterConfiguration() {
  return useSelector<any, FilterConfiguration>(
    state =>
      state.dashboardInfo?.metadata?.filter_configuration ||
      defaultFilterConfiguration,
  );
}

/**
 * returns the dashboard's filter configuration,
 * converted into a map of id -> filter
 */
export function useFilterConfigMap() {
  const filterConfig = useFilterConfiguration();
  return useMemo(
    () =>
      filterConfig.reduce((acc: Record<string, Filter>, filter: Filter) => {
        acc[filter.id] = filter;
        return acc;
      }, {} as Record<string, Filter>),
    [filterConfig],
  );
}

export function useFilterState(id: string) {
  return useSelector<any, FilterState>(state => {
    return state.nativeFilters.filtersState[id] || getInitialFilterState(id);
  });
}

export function useSetExtraFormData() {
  const dispatch = useDispatch();
  return useCallback(
    (id: string, extraFormData: ExtraFormData) =>
      dispatch(setExtraFormData(id, extraFormData)),
    [dispatch],
  );
}

export function useFilterScopeTree(): {
  treeData: [TreeItem];
  layout: Layout;
} {
  const layout = useSelector<RootState, Layout>(
    ({ dashboardLayout: { present } }) => present,
  );

  const charts = useSelector<RootState, Charts>(({ charts }) => charts);

  const tree = {
    children: [],
    key: DASHBOARD_ROOT_ID,
    type: DASHBOARD_ROOT_TYPE,
    title: t('All Panels'),
  };
  buildTree(layout[DASHBOARD_ROOT_ID], tree, layout, charts);
  return { treeData: [tree], layout };
}

export function useCascadingFilters(id: string) {
  return useSelector<any, ExtraFormData>(state => {
    const { nativeFilters }: { nativeFilters: NativeFiltersState } = state;
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
  });
}
