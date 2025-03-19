// DODO was here
import { isEmpty } from 'lodash';
import { mapValues, flow, keyBy } from 'lodash/fp';
import { bootstrapData } from 'src/preamble'; // DODO added 44211759
import { FilterPlugins } from 'src/constants'; // DODO added 44211759
import {
  getChartIdAndColumnFromFilterKey,
  getDashboardFilterKey,
} from './getDashboardFilterKey';
import { CHART_TYPE } from './componentTypes';
import { DASHBOARD_FILTER_SCOPE_GLOBAL } from '../reducers/dashboardFilters';

const locale = bootstrapData?.common?.locale || 'en'; // DODO added 44211759

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
export function getAppliedFilterValues(chartId, filters) {
  // use cached data if possible
  if (!(chartId in appliedFilterValuesByChart)) {
    const applicableFilters = Object.entries(filters || activeFilters).filter(
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

/**
 * @deprecated Please use src/dashboard/util/getChartIdsInFilterScope instead
 */
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
  const { scope: scopeComponentIds, immune: immuneChartIds } =
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
export function buildActiveFilters({ dashboardFilters = {}, components = {} }) {
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

// DODO added 44211759
export function getNativeFilterColumn(nativeFilter = {}) {
  const { filterType, targets } = nativeFilter;
  if (
    filterType === FilterPlugins.SelectById ||
    filterType === FilterPlugins.SelectByIdWithTranslation
  ) {
    return targets?.[0]?.column?.id;
  }
  if (filterType === FilterPlugins.SelectWithTranslation) {
    const localisedName = `name${locale === 'ru' ? 'Ru' : ''}`;
    return targets?.[0]?.column?.[localisedName];
  }
  return targets?.[0]?.column?.name;
}
