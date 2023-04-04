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
  DataMask,
  DataMaskStateWithId,
  DataMaskType,
  ensureIsArray,
  FeatureFlag,
  Filters,
  FilterState,
  getColumnLabel,
  isFeatureEnabled,
  NativeFilterType,
  NO_TIME_RANGE,
  QueryFormColumn,
} from '@superset-ui/core';
import { TIME_FILTER_MAP } from 'src/explore/constants';
import { getChartIdsInFilterBoxScope } from 'src/dashboard/util/activeDashboardFilters';
import { ChartConfiguration } from 'src/dashboard/reducers/types';
import { DashboardLayout, Layout } from 'src/dashboard/types';
import { areObjectsEqual } from 'src/reduxUtils';

export enum IndicatorStatus {
  Unset = 'UNSET',
  Applied = 'APPLIED',
  Incompatible = 'INCOMPATIBLE',
  CrossFilterApplied = 'CROSS_FILTER_APPLIED',
}

const TIME_GRANULARITY_FIELDS = new Set(Object.values(TIME_FILTER_MAP));

// As of 2020-09-28, the Dataset type in superset-ui is incorrect.
// Should patch it here until the Dataset type is updated.
type Datasource = {
  time_grain_sqla?: [string, string][];
  granularity?: [string, string][];
  verbose_map?: Record<string, string>;
};

type Filter = {
  chartId: number;
  columns: { [key: string]: string | string[] };
  scopes: { [key: string]: any };
  labels: { [key: string]: string };
  isDateFilter: boolean;
  directPathToFilter: string[];
  datasourceId: string;
};

export const extractLabel = (filter?: FilterState): string | null => {
  if (filter?.label && !filter?.label?.includes(undefined)) {
    return filter.label;
  }
  if (filter?.value) {
    return ensureIsArray(filter?.value).join(', ');
  }
  return null;
};

const selectIndicatorValue = (
  columnKey: string,
  filter: Filter,
  datasource: Datasource,
): any => {
  const values = filter.columns[columnKey];
  const arrValues = Array.isArray(values) ? values : [values];

  if (
    values == null ||
    (filter.isDateFilter && values === NO_TIME_RANGE) ||
    arrValues.length === 0
  ) {
    return [];
  }

  if (filter.isDateFilter && TIME_GRANULARITY_FIELDS.has(columnKey)) {
    const timeGranularityMap = (
      (columnKey === TIME_FILTER_MAP.time_grain_sqla
        ? datasource.time_grain_sqla
        : datasource.granularity) || []
    ).reduce(
      (map, [key, value]) => ({
        ...map,
        [key]: value,
      }),
      {},
    );

    return arrValues.map(value => timeGranularityMap[value] || value);
  }

  return arrValues;
};

const selectIndicatorsForChartFromFilter = (
  chartId: number,
  filter: Filter,
  filterDataSource: Datasource,
  appliedColumns: Set<string>,
  rejectedColumns: Set<string>,
): Indicator[] => {
  // filters can be applied (if the filter is compatible with the datasource)
  // or rejected (if the filter is incompatible)
  // or the status can be unknown (if the filter has calculated parameters that we can't analyze)
  const getStatus = (column: string, filter: Filter) => {
    if (appliedColumns.has(column) && filter.columns[column])
      return IndicatorStatus.Applied;
    if (rejectedColumns.has(column)) return IndicatorStatus.Incompatible;
    return IndicatorStatus.Unset;
  };

  return Object.keys(filter.columns)
    .filter(column =>
      getChartIdsInFilterBoxScope({
        filterScope: filter.scopes[column],
      }).includes(chartId),
    )
    .map(column => ({
      column,
      name: filter.labels[column] || column,
      value: selectIndicatorValue(column, filter, filterDataSource),
      status: getStatus(column, filter),
      path: filter.directPathToFilter,
    }));
};

const getAppliedColumns = (chart: any): Set<string> =>
  new Set(
    (chart?.queriesResponse?.[0]?.applied_filters || []).map(
      (filter: any) => filter.column,
    ),
  );

const getRejectedColumns = (chart: any): Set<string> =>
  new Set(
    (chart?.queriesResponse?.[0]?.rejected_filters || []).map((filter: any) =>
      getColumnLabel(filter.column),
    ),
  );

export type Indicator = {
  column?: QueryFormColumn;
  name: string;
  value?: any;
  status?: IndicatorStatus;
  path?: string[];
};

export type CrossFilterIndicator = Indicator & { emitterId: number };

export const getCrossFilterIndicator = (
  chartId: number,
  dataMask: DataMask,
  dashboardLayout: DashboardLayout,
) => {
  const filterState = dataMask?.filterState;
  const filters = dataMask?.extraFormData?.filters;
  const label = extractLabel(filterState);
  const filtersState = filterState?.filters;
  const column =
    filters?.[0]?.col || (filtersState && Object.keys(filtersState)[0]);

  const dashboardLayoutItem = Object.values(dashboardLayout).find(
    layoutItem => layoutItem?.meta?.chartId === chartId,
  );
  const filterObject: Indicator = {
    column,
    name:
      dashboardLayoutItem?.meta?.sliceNameOverride ||
      dashboardLayoutItem?.meta?.sliceName ||
      '',
    path: [
      ...(dashboardLayoutItem?.parents ?? []),
      dashboardLayoutItem?.id || '',
    ],
    value: label,
  };
  return filterObject;
};

const cachedIndicatorsForChart = {};
const cachedDashboardFilterDataForChart = {};
// inspects redux state to find what the filter indicators should be shown for a given chart
export const selectIndicatorsForChart = (
  chartId: number,
  filters: { [key: number]: Filter },
  datasources: { [key: string]: Datasource },
  chart: any,
): Indicator[] => {
  // for now we only need to know which columns are compatible/incompatible,
  // so grab the columns from the applied/rejected filters
  const appliedColumns = getAppliedColumns(chart);
  const rejectedColumns = getRejectedColumns(chart);
  const matchingFilters = Object.values(filters).filter(
    filter => filter.chartId !== chartId,
  );
  const matchingDatasources = Object.entries(datasources)
    .filter(([key]) =>
      matchingFilters.find(filter => filter.datasourceId === key),
    )
    .map(([, datasource]) => datasource);

  const cachedFilterData = cachedDashboardFilterDataForChart[chartId];
  if (
    cachedIndicatorsForChart[chartId] &&
    areObjectsEqual(cachedFilterData?.appliedColumns, appliedColumns) &&
    areObjectsEqual(cachedFilterData?.rejectedColumns, rejectedColumns) &&
    areObjectsEqual(cachedFilterData?.matchingFilters, matchingFilters) &&
    areObjectsEqual(cachedFilterData?.matchingDatasources, matchingDatasources)
  ) {
    return cachedIndicatorsForChart[chartId];
  }
  const indicators = matchingFilters.reduce(
    (acc, filter) =>
      acc.concat(
        selectIndicatorsForChartFromFilter(
          chartId,
          filter,
          datasources[filter.datasourceId] || {},
          appliedColumns,
          rejectedColumns,
        ),
      ),
    [] as Indicator[],
  );
  indicators.sort((a, b) => a.name.localeCompare(b.name));
  cachedIndicatorsForChart[chartId] = indicators;
  cachedDashboardFilterDataForChart[chartId] = {
    appliedColumns,
    rejectedColumns,
    matchingFilters,
    matchingDatasources,
  };
  return indicators;
};

const getStatus = ({
  label,
  column,
  type = DataMaskType.NativeFilters,
  rejectedColumns,
  appliedColumns,
}: {
  label: string | null;
  column?: string;
  type?: DataMaskType;
  rejectedColumns?: Set<string>;
  appliedColumns?: Set<string>;
}): IndicatorStatus => {
  // a filter is only considered unset if it's value is null
  const hasValue = label !== null;
  const APPLIED_STATUS =
    type === DataMaskType.CrossFilters
      ? IndicatorStatus.CrossFilterApplied
      : IndicatorStatus.Applied;
  if (!column && hasValue) {
    // Filter without datasource
    return APPLIED_STATUS;
  }
  if (column && rejectedColumns?.has(column))
    return IndicatorStatus.Incompatible;
  if (column && appliedColumns?.has(column) && hasValue) {
    return APPLIED_STATUS;
  }
  return IndicatorStatus.Unset;
};

const defaultChartConfig = {};
export const selectChartCrossFilters = (
  dataMask: DataMaskStateWithId,
  chartId: number,
  dashboardLayout: Layout,
  chartConfiguration: ChartConfiguration = defaultChartConfig,
  appliedColumns: Set<string>,
  rejectedColumns: Set<string>,
  filterEmitter = false,
): Indicator[] | CrossFilterIndicator[] => {
  let crossFilterIndicators: any = [];
  if (isFeatureEnabled(FeatureFlag.DASHBOARD_CROSS_FILTERS)) {
    crossFilterIndicators = Object.values(chartConfiguration)
      .filter(chartConfig => {
        const inScope =
          chartConfig.crossFilters?.chartsInScope?.includes(chartId);
        if (!filterEmitter && inScope) {
          return true;
        }
        if (filterEmitter && !inScope) {
          return true;
        }
        return false;
      })
      .map(chartConfig => {
        const filterIndicator = getCrossFilterIndicator(
          chartConfig.id,
          dataMask[chartConfig.id],
          dashboardLayout,
        );
        const filterStatus = getStatus({
          label: filterIndicator.value,
          column: filterIndicator.column
            ? getColumnLabel(filterIndicator.column)
            : undefined,
          type: DataMaskType.CrossFilters,
          appliedColumns,
          rejectedColumns,
        });

        return { ...filterIndicator, status: filterStatus };
      })
      .filter(filter => filter.status === IndicatorStatus.CrossFilterApplied);
  }

  return crossFilterIndicators;
};

const cachedNativeIndicatorsForChart = {};
const cachedNativeFilterDataForChart: any = {};
export const selectNativeIndicatorsForChart = (
  nativeFilters: Filters,
  dataMask: DataMaskStateWithId,
  chartId: number,
  chart: any,
  dashboardLayout: Layout,
  chartConfiguration: ChartConfiguration = defaultChartConfig,
): Indicator[] => {
  const appliedColumns = getAppliedColumns(chart);
  const rejectedColumns = getRejectedColumns(chart);

  const cachedFilterData = cachedNativeFilterDataForChart[chartId];
  if (
    cachedNativeIndicatorsForChart[chartId] &&
    areObjectsEqual(cachedFilterData?.appliedColumns, appliedColumns) &&
    areObjectsEqual(cachedFilterData?.rejectedColumns, rejectedColumns) &&
    cachedFilterData?.nativeFilters === nativeFilters &&
    cachedFilterData?.dashboardLayout === dashboardLayout &&
    cachedFilterData?.chartConfiguration === chartConfiguration &&
    cachedFilterData?.dataMask === dataMask
  ) {
    return cachedNativeIndicatorsForChart[chartId];
  }

  let nativeFilterIndicators: any = [];
  if (isFeatureEnabled(FeatureFlag.DASHBOARD_NATIVE_FILTERS)) {
    nativeFilterIndicators =
      nativeFilters &&
      Object.values(nativeFilters)
        .filter(
          nativeFilter =>
            nativeFilter.type === NativeFilterType.NATIVE_FILTER &&
            nativeFilter.chartsInScope?.includes(chartId),
        )
        .map(nativeFilter => {
          const column = nativeFilter.targets?.[0]?.column?.name;
          const filterState = dataMask[nativeFilter.id]?.filterState;
          const label = extractLabel(filterState);
          return {
            column,
            name: nativeFilter.name,
            path: [nativeFilter.id],
            status: getStatus({
              label,
              column,
              rejectedColumns,
              appliedColumns,
            }),
            value: label,
          };
        });
  }

  let crossFilterIndicators: any = [];
  if (isFeatureEnabled(FeatureFlag.DASHBOARD_CROSS_FILTERS)) {
    crossFilterIndicators = selectChartCrossFilters(
      dataMask,
      chartId,
      dashboardLayout,
      chartConfiguration,
      appliedColumns,
      rejectedColumns,
    );
  }
  const indicators = crossFilterIndicators.concat(nativeFilterIndicators);
  cachedNativeIndicatorsForChart[chartId] = indicators;
  cachedNativeFilterDataForChart[chartId] = {
    nativeFilters,
    dashboardLayout,
    chartConfiguration,
    dataMask,
    appliedColumns,
    rejectedColumns,
  };
  return indicators;
};
