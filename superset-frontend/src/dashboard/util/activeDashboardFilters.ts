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
import { isEmpty } from 'lodash';
import { mapValues, flow, keyBy } from 'lodash/fp';
import {
  JsonValue,
  DataRecordFilters,
  DataRecordValue,
} from '@superset-ui/core';
import {
  getChartIdAndColumnFromFilterKey,
  getDashboardFilterKey,
} from './getDashboardFilterKey';
import { CHART_TYPE } from './componentTypes';
import { DASHBOARD_FILTER_SCOPE_GLOBAL } from '../reducers/dashboardFilters';
import { LayoutItem } from '../types';

// Type definitions for filters
interface FilterScope {
  scope: string[];
  immune?: number[];
}

interface DashboardFilterColumn {
  [column: string]: JsonValue[] | JsonValue;
}

interface DashboardFilterScopes {
  [column: string]: FilterScope;
}

interface DashboardFilter {
  chartId: number;
  columns: DashboardFilterColumn;
  scopes: DashboardFilterScopes;
}

interface DashboardFilters {
  [filterId: string]: DashboardFilter;
}

interface Components {
  [componentId: string]: LayoutItem;
}

interface ActiveFilter {
  values: JsonValue[] | JsonValue;
  scope: number[];
}

interface ActiveFilters {
  [filterKey: string]: ActiveFilter;
}

interface AppliedFilterValuesByChart {
  [chartId: number]: DataRecordFilters;
}

interface GetChartIdsInFilterScopeProps {
  filterScope?: FilterScope;
}

interface BuildActiveFiltersProps {
  dashboardFilters?: DashboardFilters;
  components?: Components;
}

let activeFilters: ActiveFilters = {};
let appliedFilterValuesByChart: AppliedFilterValuesByChart = {};
let allComponents: Components = {};

// output: { [id_column]: { values, scope } }
export function getActiveFilters(): ActiveFilters {
  return activeFilters;
}

// this function is to find all filter values applied to a chart,
// it goes through all active filters and their scopes.
// return: { [column]: array of selected values }
export function getAppliedFilterValues(
  chartId: number,
  filters?: ActiveFilters,
): DataRecordFilters {
  // use cached data if possible
  if (!(chartId in appliedFilterValuesByChart)) {
    const applicableFilters = Object.entries(filters || activeFilters).filter(
      ([, { scope: chartIds }]) => chartIds.includes(chartId),
    );
    appliedFilterValuesByChart[chartId] = flow(
      keyBy(
        ([filterKey]: [string, ActiveFilter]) =>
          getChartIdAndColumnFromFilterKey(filterKey).column,
      ),
      mapValues(([, { values }]: [string, ActiveFilter]) => {
        // Ensure values is always an array of DataRecordValue
        if (Array.isArray(values)) {
          return values.filter(
            val => val !== null && val !== undefined,
          ) as DataRecordValue[];
        }
        // If single value, wrap in array and filter valid values
        return values !== null && values !== undefined
          ? [values as DataRecordValue]
          : [];
      }),
    )(applicableFilters);
  }
  return appliedFilterValuesByChart[chartId];
}

/**
 * @deprecated Please use src/dashboard/util/getChartIdsInFilterScope instead
 */
export function getChartIdsInFilterScope({
  filterScope,
}: GetChartIdsInFilterScopeProps): number[] {
  function traverse(
    chartIds: number[] = [],
    component: LayoutItem | undefined = undefined,
    immuneChartIds: number[] = [],
  ): void {
    if (!component) {
      return;
    }

    if (
      component.type === CHART_TYPE &&
      component.meta &&
      component.meta.chartId &&
      !immuneChartIds.includes(component.meta.chartId)
    ) {
      chartIds.push(component.meta.chartId);
    } else if (component.children) {
      component.children.forEach(child =>
        traverse(chartIds, allComponents[child], immuneChartIds),
      );
    }
  }

  const chartIds: number[] = [];
  const { scope: scopeComponentIds, immune: immuneChartIds = [] } =
    filterScope || DASHBOARD_FILTER_SCOPE_GLOBAL;
  scopeComponentIds.forEach(componentId =>
    traverse(chartIds, allComponents[componentId], immuneChartIds),
  );

  return chartIds;
}

// non-empty filter fields in dashboardFilters,
// activeFilters map contains selected values and filter scope.
// values: array of selected values
// scope: array of chartIds that applicable to the filter field.
export function buildActiveFilters({
  dashboardFilters = {},
  components = {},
}: BuildActiveFiltersProps): void {
  // clear cache
  if (!isEmpty(components)) {
    allComponents = components;
  }
  appliedFilterValuesByChart = {};
  activeFilters = Object.values(dashboardFilters).reduce(
    (result: ActiveFilters, filter: DashboardFilter) => {
      const { chartId, columns, scopes } = filter;
      const nonEmptyFilters: ActiveFilters = {};

      Object.keys(columns).forEach(column => {
        if (
          Array.isArray(columns[column])
            ? (columns[column] as JsonValue[]).length
            : columns[column] !== undefined
        ) {
          // remove filter itself
          const scope = getChartIdsInFilterScope({
            filterScope: scopes[column],
          }).filter(id => chartId !== id);

          nonEmptyFilters[
            getDashboardFilterKey({ chartId: String(chartId), column })
          ] = {
            values: columns[column],
            scope,
          };
        }
      });

      return {
        ...result,
        ...nonEmptyFilters,
      };
    },
    {},
  );
}
