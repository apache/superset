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
import { selectFilterOption } from 'src/dashboard/actions/nativeFilters';
import { getInitialFilterState } from 'src/dashboard/reducers/nativeFilters';
import { QueryObjectFilterClause, t } from '@superset-ui/core';
import {
  Charts,
  Filter,
  FilterConfiguration,
  FilterState,
  Layout, NativeFiltersState,
  RootState,
  TreeItem,
} from './types';
import { DASHBOARD_ROOT_ID } from '../../util/constants';
import { DASHBOARD_ROOT_TYPE } from '../../util/componentTypes';
import { buildTree } from './utils';

const defaultFilterConfiguration: Filter[] = [];

export function useFilterConfiguration() {
  return useSelector<any, FilterConfiguration>(
    state =>
      state.dashboardInfo.metadata.filter_configuration ||
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

export function useFilterSetter(id: string) {
  const dispatch = useDispatch();
  return useCallback(
    (values: string | string[] | null) =>
      dispatch(selectFilterOption(id, values)),
    [id, dispatch],
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
  const filterConfiguration = useFilterConfiguration();
  return useSelector<any, QueryObjectFilterClause[]>(state => {
    const cascadedFilters: QueryObjectFilterClause[] = [];
    const { nativeFilters }: { nativeFilters: NativeFiltersState } = state;
    const { filters, filtersState } = nativeFilters;
    const parents: string[] = [];
    // assume that parents should always cascade to children based on order
    // in filter config
    filterConfiguration.some(filter => {
      const { id: parentId } = filter;
      if (id !== parentId) parents.push(parentId);
      return id === parentId;
    });
    parents.forEach(filterId => {
      const filter = filters[filterId];
      const filterState = filtersState[filterId];
      const { targets } = filter;
      const [target] = targets;
      const { column, datasetId } = target;
      const { selectedValues } = filterState;
      const { name: col } = column;
      if (selectedValues && selectedValues.length > 0) {
        cascadedFilters.push({ col, op: 'IN', val: selectedValues });
      }
    });
    return cascadedFilters;
  });
}
