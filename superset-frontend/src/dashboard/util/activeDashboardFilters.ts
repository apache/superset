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
import { CHART_TYPE } from './componentTypes';
import { DASHBOARD_FILTER_SCOPE_GLOBAL } from '../reducers/dashboardFilters';

let activeFilters = {};
let appliedFilterValuesByChart = {};
let allComponents = {};

// output: { [id_column]: { values, scope } }
export function getActiveFilters() {
  return activeFilters;
}

// this function is to find all filter values applied to a chart,
// it goes through all active filters and their scopes.
// return: { [column]: array of selected values }
export function getAppliedFilterValues(chartId: $TSFixMe, filters: $TSFixMe) {
  // use cached data if possible
  if (!(chartId in appliedFilterValuesByChart)) {
    const applicableFilters = Object.entries(filters || activeFilters).filter(
      // @ts-expect-error TS(2339): Property 'scope' does not exist on type 'unknown'.
      ([, { scope: chartIds }]) => chartIds.includes(chartId),
    );
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    appliedFilterValuesByChart[chartId] = flow(
      keyBy(
        ([filterKey]) => getChartIdAndColumnFromFilterKey(filterKey).column,
      ),
      mapValues(([, { values }]) => values),
    )(applicableFilters);
  }
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return appliedFilterValuesByChart[chartId];
}

/**
 * @deprecated Please use src/dashboard/util/getChartIdsInFilterScope instead
 */
export function getChartIdsInFilterScope({ filterScope }: $TSFixMe) {
  function traverse(chartIds = [], component = {}, immuneChartIds = []) {
    if (!component) {
      return;
    }

    if (
      // @ts-expect-error TS(2339): Property 'type' does not exist on type '{}'.
      component.type === CHART_TYPE &&
      // @ts-expect-error TS(2339): Property 'meta' does not exist on type '{}'.
      component.meta &&
      // @ts-expect-error TS(2339): Property 'meta' does not exist on type '{}'.
      component.meta.chartId &&
      // @ts-expect-error TS(2345): Argument of type 'any' is not assignable to parame... Remove this comment to see the full error message
      !immuneChartIds.includes(component.meta.chartId)
    ) {
      // @ts-expect-error TS(2345): Argument of type 'any' is not assignable to parame... Remove this comment to see the full error message
      chartIds.push(component.meta.chartId);
      // @ts-expect-error TS(2339): Property 'children' does not exist on type '{}'.
    } else if (component.children) {
      // @ts-expect-error TS(2339): Property 'children' does not exist on type '{}'.
      component.children.forEach((child: $TSFixMe) =>
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        traverse(chartIds, allComponents[child], immuneChartIds),
      );
    }
  }

  const chartIds: $TSFixMe = [];
  const { scope: scopeComponentIds, immune: immuneChartIds } =
    filterScope || DASHBOARD_FILTER_SCOPE_GLOBAL;
  scopeComponentIds.forEach((componentId: $TSFixMe) =>
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    traverse(chartIds, allComponents[componentId], immuneChartIds),
  );

  return chartIds;
}

// non-empty filter fields in dashboardFilters,
// activeFilters map contains selected values and filter scope.
// values: array of selected values
// scope: array of chartIds that applicable to the filter field.
export function buildActiveFilters({ dashboardFilters = {}, components = {} }) {
  // clear cache
  if (!isEmpty(components)) {
    allComponents = components;
  }
  appliedFilterValuesByChart = {};
  // @ts-expect-error TS(2322): Type 'unknown' is not assignable to type '{}'.
  activeFilters = Object.values(dashboardFilters).reduce((result, filter) => {
    // @ts-expect-error TS(2339): Property 'chartId' does not exist on type 'unknown... Remove this comment to see the full error message
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
          // @ts-expect-error TS(7006): Parameter 'id' implicitly has an 'any' type.
        }).filter(id => chartId !== id);

        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        nonEmptyFilters[getDashboardFilterKey({ chartId, column })] = {
          values: columns[column],
          scope,
        };
      }
    });

    return {
      // @ts-expect-error TS(2698): Spread types may only be created from object types... Remove this comment to see the full error message
      ...result,
      ...nonEmptyFilters,
    };
  }, {});
}
