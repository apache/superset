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
  getChartIdAndColumnFromFilterKey,
  getDashboardFilterKey,
} from './getDashboardFilterKey';
import { CHART_TYPE } from '../util/componentTypes';

let allFilterBoxChartIds = [];
let activeFilters = {};
let appliedFilterValuesByChart = {};
let allComponents = {};

// output: { [id_column]: { values, scope } }
export function getActiveFilters() {
  return activeFilters;
}

// currently filter_box is a chart,
// when selecting filter scopes, they have to be out pulled out in a few places.
// after we make filter_box a dashboard build-in component, will not need this check anymore.
export function isFilterBox(chartId) {
  return allFilterBoxChartIds.includes(chartId);
}

// this function is to find all filter values applied to a chart,
// it goes through all active filters and their scopes.
// return: { [column]: array of selected values }
export function getAppliedFilterValues(chartId) {
  // use cached data if possible
  if (!(chartId in appliedFilterValuesByChart)) {
    const applicableFilters = Object.entries(activeFilters).filter(
      ([, { scope: chartIds }]) => chartIds.includes(chartId),
    );
    appliedFilterValuesByChart[chartId] = flow(
      keyBy(
        ([filterKey]) => getChartIdAndColumnFromFilterKey(filterKey).column,
      ),
      mapValues(([, { values }]) => values),
    )(applicableFilters);
  }
  return appliedFilterValuesByChart[chartId];
}

export function getChartIdsInFilterScope({ filterScope }) {
  function traverse(chartIds = [], component = {}, immuneChartIds = []) {
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

  const chartIds = [];
  const { scope: scopeComponentIds, immune: immuneChartIds } = filterScope;
  scopeComponentIds.forEach(componentId =>
    traverse(chartIds, allComponents[componentId], immuneChartIds),
  );

  return chartIds;
}

// non-empty filter fields in dashboardFilters,
// activeFilters map contains selected values and filter scope.
// values: array of selected values
// scope: array of chartIds that applicable to the filter field.
export function buildActiveFilters({ dashboardFilters = {}, components = {} }) {
  allFilterBoxChartIds = Object.values(dashboardFilters).map(
    filter => filter.chartId,
  );

  // clear cache
  if (!isEmpty(components)) {
    allComponents = components;
  }
  appliedFilterValuesByChart = {};
  activeFilters = Object.values(dashboardFilters).reduce((result, filter) => {
    const { chartId, columns, scopes } = filter;
    const nonEmptyFilters = {};

    Object.keys(columns).forEach(column => {
      if (
        Array.isArray(columns[column])
          ? columns[column].length
          : columns[column] !== undefined
      ) {
        // remove filter itself
        const scope = getChartIdsInFilterScope({
          filterScope: scopes[column],
        }).filter(id => chartId !== id);

        nonEmptyFilters[getDashboardFilterKey({ chartId, column })] = {
          values: columns[column],
          scope,
        };
      }
    });

    return {
      ...result,
      ...nonEmptyFilters,
    };
  }, {});
}
