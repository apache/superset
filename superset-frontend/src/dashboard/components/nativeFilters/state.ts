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
import { useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setExtraFormData } from 'src/dashboard/actions/nativeFilters';
import { getInitialFilterState } from 'src/dashboard/reducers/nativeFilters';
import { ExtraFormData, t } from '@superset-ui/core';
import { Charts, Layout, RootState } from 'src/dashboard/types';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import {
  CHART_TYPE,
  DASHBOARD_ROOT_TYPE,
} from 'src/dashboard/util/componentTypes';
import { FormInstance } from 'antd/lib/form';
import { getChartDataRequest } from 'src/chart/chartAction';
import {
  CurrentFilterState,
  Filter,
  FilterConfiguration,
  FilterState,
  NativeFiltersForm,
  NativeFiltersState,
  TreeItem,
} from './types';
import {
  buildTree,
  getFormData,
  mergeExtraFormData,
  setFilterFieldValues,
  useForceUpdate,
} from './utils';

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
  return useSelector<any, FilterState>(
    state => state.nativeFilters.filtersState[id] || getInitialFilterState(id),
  );
}

export function useFiltersState() {
  return useSelector<any, FilterState>(
    state => state.nativeFilters.filtersState,
  );
}

export function useFilters() {
  return useSelector<any, FilterState>(state => state.nativeFilters.filters);
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
    title: t('All panels'),
  };

  // We need to get only nodes that have charts as children or grandchildren
  const validNodes = useMemo(
    () =>
      Object.values(layout).reduce<string[]>((acc, cur) => {
        if (cur?.type === CHART_TYPE) {
          return [...new Set([...acc, ...cur?.parents, cur.id])];
        }
        return acc;
      }, []),
    [layout],
  );

  useMemo(() => {
    buildTree(layout[DASHBOARD_ROOT_ID], tree, layout, charts, validNodes);
  }, [charts, layout, tree]);

  return { treeData: [tree], layout };
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

// When some fields in form changed we need re-fetch data for Filter defaultValue
export const useBackendFormUpdate = (
  form: FormInstance<NativeFiltersForm>,
  filterId: string,
  filterToEdit?: Filter,
) => {
  const forceUpdate = useForceUpdate();
  const formFilter = (form.getFieldValue('filters') || {})[filterId];
  useEffect(() => {
    let resolvedDefaultValue: any = null;
    // No need to check data set change because it cascading update column
    // So check that column exists is enough
    if (!formFilter?.column) {
      setFilterFieldValues(form, filterId, {
        defaultValueQueriesData: [],
        defaultValue: resolvedDefaultValue,
      });
      return;
    }
    const formData = getFormData({
      datasetId: formFilter?.dataset?.value,
      groupby: formFilter?.column,
      allowsMultipleValues: formFilter?.allowsMultipleValues,
      defaultValue: formFilter?.defaultValue,
      inverseSelection: formFilter?.inverseSelection,
    });
    getChartDataRequest({
      formData,
      force: false,
      requestParams: { dashboardId: 0 },
    }).then(response => {
      if (
        filterToEdit?.filterType === formFilter?.filterType &&
        filterToEdit?.targets[0].datasetId === formFilter?.dataset?.value &&
        formFilter?.column === filterToEdit?.targets[0]?.column?.name &&
        filterToEdit?.allowsMultipleValues === formFilter?.allowsMultipleValues
      ) {
        resolvedDefaultValue = filterToEdit?.defaultValue;
      }
      setFilterFieldValues(form, filterId, {
        defaultValueQueriesData: response.result,
        defaultValue: resolvedDefaultValue,
      });
      forceUpdate();
    });
  }, [
    formFilter?.filterType,
    formFilter?.column,
    formFilter?.dataset?.value,
    filterId,
  ]);
};
