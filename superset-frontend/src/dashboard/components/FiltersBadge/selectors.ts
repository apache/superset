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
import { getChartIdsInFilterScope } from '../../util/activeDashboardFilters';
import { TIME_FILTER_MAP } from '../../../visualizations/FilterBox/FilterBox';

export enum IndicatorStatus {
  Unset = 'UNSET',
  Applied = 'APPLIED',
  Incompatible = 'INCOMPATIBLE',
}

const TIME_GRANULARITY_FIELDS = new Set(Object.values(TIME_FILTER_MAP));

// As of 2020-09-28, the DatasourceMeta type in superset-ui is incorrect.
// Should patch it here until the DatasourceMeta type is updated.
type Datasource = {
  time_grain_sqla?: [string, string][];
  granularity?: [string, string][];
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

const selectIndicatorValue = (
  columnKey: string,
  filter: Filter,
  datasource: Datasource,
): string[] => {
  const values = filter.columns[columnKey];
  const arrValues = Array.isArray(values) ? values : [values];

  if (
    values == null ||
    (filter.isDateFilter && values === 'No filter') ||
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
  const getStatus = (column: string) => {
    if (appliedColumns.has(column)) return IndicatorStatus.Applied;
    if (rejectedColumns.has(column)) return IndicatorStatus.Incompatible;
    return IndicatorStatus.Unset;
  };

  return Object.keys(filter.columns)
    .filter(column =>
      getChartIdsInFilterScope({
        filterScope: filter.scopes[column],
      }).includes(chartId),
    )
    .map(column => ({
      column,
      name: filter.labels[column] || column,
      value: selectIndicatorValue(column, filter, filterDataSource),
      status: getStatus(column),
      path: filter.directPathToFilter,
    }));
};

export type Indicator = {
  column: string;
  name: string;
  value: string[];
  status: IndicatorStatus;
  path: string[];
};

// inspects redux state to find what the filter indicators should be shown for a given chart
export const selectIndicatorsForChart = (
  chartId: number,
  filters: { [key: number]: Filter },
  datasources: { [key: string]: Datasource },
  charts: any,
): Indicator[] => {
  const chart = charts[chartId];
  // no indicators if chart is loading
  if (chart.chartStatus === 'loading') return [];

  // for now we only need to know which columns are compatible/incompatible,
  // so grab the columns from the applied/rejected filters
  const appliedColumns: Set<string> = new Set(
    (chart?.queriesResponse?.[0]?.applied_filters || []).map(
      (filter: any) => filter.column,
    ),
  );
  const rejectedColumns: Set<string> = new Set(
    (chart?.queriesResponse?.[0]?.rejected_filters || []).map(
      (filter: any) => filter.column,
    ),
  );
  const indicators = Object.values(filters)
    .filter(filter => filter.chartId !== chartId)
    .reduce(
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
  return indicators;
};
