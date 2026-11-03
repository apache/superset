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
import { useSelector } from 'react-redux';
import { Filter, NativeFilterType } from '@superset-ui/core';
import { TIME_FILTER_MAP } from 'src/explore/constants';
import type { DynamicTitleConfig, RootState } from 'src/dashboard/types';
import { useFilterConfiguration } from '../components/nativeFilters/state';
import { getExtraFormData } from '../components/nativeFilters/utils';
import {
  getAppliedColumns,
  getRejectedColumns,
} from '../components/nativeFilters/selectors';
import { DASHBOARD_ROOT_ID } from './constants';
import {
  createChartLayoutItemMap,
  getChartIdsInFilterScope,
} from './getChartIdsInFilterScope';
import { useChartLayoutItems } from './useChartLayoutItems';
import {
  getAllActiveFilters,
  getFilterIdsAppliedOnChart,
} from './activeAllDashboardFilters';
import {
  getDynamicTitleFilterValue,
  hasNoTemporalTitleSupport,
  resolveDynamicTitle,
} from './dynamicTitle';

export function useDynamicChartTitle(
  chartId: number,
  baseTitle: string,
  config?: DynamicTitleConfig,
) {
  const enabled = Boolean(config);
  const nativeFilters = useFilterConfiguration();
  const dataMask = useSelector((state: RootState) =>
    enabled ? state.dataMask : undefined,
  );
  const nativeFilterState = useSelector((state: RootState) =>
    enabled ? state.nativeFilters?.filters : undefined,
  );
  const chartConfiguration = useSelector((state: RootState) =>
    enabled ? state.dashboardInfo?.metadata?.chart_configuration : undefined,
  );
  const sliceIds = useSelector((state: RootState) =>
    enabled ? state.dashboardState?.sliceIds : undefined,
  );
  const layoutItems = useChartLayoutItems();
  const chart = useSelector((state: RootState) =>
    enabled ? state.charts[chartId] : undefined,
  );
  const datasource = useSelector((state: RootState) =>
    enabled && chart?.form_data?.datasource
      ? state.datasources[chart.form_data.datasource]
      : undefined,
  );
  const filters = useMemo(() => {
    if (!enabled) {
      return [];
    }
    const layoutMap = createChartLayoutItemMap(layoutItems);
    const chartIds = Array.from(layoutMap.keys());
    const activeFilters = getAllActiveFilters({
      chartConfiguration: chartConfiguration ?? {},
      nativeFilters: nativeFilterState ?? {},
      dataMask: dataMask ?? {},
      allSliceIds: sliceIds ?? chartIds,
    });
    const extraFormData = getExtraFormData(
      dataMask ?? {},
      getFilterIdsAppliedOnChart(activeFilters, nativeFilterState, chartId),
    );
    const rejectedColumns = getRejectedColumns(chart);
    const appliedColumns = getAppliedColumns(chart);
    const noTemporalSupport = hasNoTemporalTitleSupport(
      datasource,
      chart?.form_data,
    );
    return nativeFilters
      .filter(
        (filter): filter is Filter =>
          filter.type === NativeFilterType.NativeFilter &&
          getChartIdsInFilterScope(
            filter.scope ?? { rootPath: [DASHBOARD_ROOT_ID], excluded: [] },
            chartIds,
            layoutMap,
          ).includes(chartId),
      )
      .map(filter => {
        const mask = dataMask?.[filter.id];
        const rejected =
          rejectedColumns.has(filter.targets?.[0]?.column?.name ?? '') ||
          Object.entries(TIME_FILTER_MAP).some(
            ([field, column]) =>
              mask?.extraFormData?.[field as keyof typeof TIME_FILTER_MAP] !==
                undefined &&
              (rejectedColumns.has(column) ||
                (noTemporalSupport && !appliedColumns.has(column)) ||
                mask.extraFormData[field as keyof typeof TIME_FILTER_MAP] !==
                  extraFormData[field as keyof typeof TIME_FILTER_MAP]),
          );
        return {
          id: filter.id,
          name: filter.name || filter.id,
          value: rejected
            ? undefined
            : getDynamicTitleFilterValue(filter, mask),
        };
      });
  }, [
    chartId,
    nativeFilters,
    dataMask,
    layoutItems,
    enabled,
    chart,
    datasource,
    nativeFilterState,
    chartConfiguration,
    sliceIds,
  ]);

  return {
    filters,
    title: resolveDynamicTitle(config, baseTitle, filters),
  };
}
