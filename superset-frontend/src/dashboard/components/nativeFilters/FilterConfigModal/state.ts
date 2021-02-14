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
import { useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { t } from '@superset-ui/core';
import { Charts, Layout, RootState } from 'src/dashboard/types';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import {
  CHART_TYPE,
  DASHBOARD_ROOT_TYPE,
} from 'src/dashboard/util/componentTypes';
import { FormInstance } from 'antd/lib/form';
import { getChartDataRequest } from 'src/chart/chartAction';
import { NativeFilterState } from 'src/dashboard/reducers/types';
import { NativeFiltersForm, TreeItem } from './types';
import { buildTree, setFilterFieldValues, useForceUpdate } from './utils';
import { Filter } from '../types';
import { getFormData } from '../utils';

export function useFiltersState() {
  return useSelector<any, NativeFilterState>(
    state => state.nativeFilters.filtersState,
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
      defaultValue: formFilter?.defaultValue,
      ...formFilter,
    });
    getChartDataRequest({
      formData,
      force: false,
      requestParams: { dashboardId: 0 },
    }).then(response => {
      if (
        filterToEdit?.filterType === formFilter?.filterType &&
        filterToEdit?.targets[0].datasetId === formFilter?.dataset?.value &&
        formFilter?.column === filterToEdit?.targets[0]?.column?.name
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
