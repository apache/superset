import { getChartIdsInFilterScope } from '../../util/activeDashboardFilters';
import { isNil, get } from 'lodash';
import { TIME_FILTER_MAP } from '../../../visualizations/FilterBox/FilterBox';

export const UNSET = 'UNSET';
export const APPLIED = 'APPLIED';
export const INCOMPATIBLE = 'INCOMPATIBLE';

const TIME_GRANULARITY_FIELDS = new Set([
  TIME_FILTER_MAP.granularity,
  TIME_FILTER_MAP.time_grain_sqla,
]);

/*
if (isDateFilter && TIME_GRANULARITY_FIELDS.includes(name)) {
    const timeGranularityConfig =
      (name === TIME_FILTER_MAP.time_grain_sqla
        ? datasource.time_grain_sqla
        : datasource.granularity) || [];
    const timeGranularityDisplayMapping = timeGranularityConfig.reduce(
      (map, [key, value]) => ({
        ...map,
        [key]: value,
      }),
      {},
    );

    indicator.values = indicator.values.map(
      value => timeGranularityDisplayMapping[value] || value,
    );
  }

  if (isEmpty(indicator.values)) {
    indicators[1].push(indicator);
  } else {
    indicators[0].push(indicator);
  }
});
 */

const selectIndicatorValue = (columnKey, filter, datasource) => {
  if (
    isNil(filter.columns[columnKey]) ||
    (filter.isDateFilter && filter.columns[columnKey] === 'No filter') ||
    (Array.isArray(filter.columns[columnKey]) &&
      filter.columns[columnKey].length === 0)
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
    return []
      .concat(filter.columns[columnKey])
      .map(value => timeGranularityMap[value] || value);
  }

  return [].concat(filter.columns[columnKey]);
};

const selectIndicatorStatus = (columnKey, filter, chart) => {
  if (
    isNil(filter.columns[columnKey]) ||
    (filter.isDateFilter && filter.columns[columnKey] === 'No filter') ||
    (Array.isArray(filter.columns[columnKey]) &&
      filter.columns[columnKey].length === 0)
  ) {
    return UNSET;
  }

  if (get(chart, 'queryResponse.rejected_filters', []).includes(columnKey)) {
    return INCOMPATIBLE;
  }

  return APPLIED;
};

const selectIndicatorsForChartFromFilter = (
  chartId,
  filter,
  filterDataSource,
  chart,
) => {
  return Object.keys(filter.columns)
    .filter(key =>
      getChartIdsInFilterScope({ filterScope: filter.scopes[key] }).includes(
        chartId,
      ),
    )
    .map(key => ({
      id: key,
      name: filter.labels[key] || key,
      value: selectIndicatorValue(key, filter, filterDataSource),
      status: selectIndicatorStatus(key, filter, chart),
      path: filter.directPathToFilter,
    }));
};

export const selectIndicatorsForChart = (
  chartId,
  filters,
  datasources,
  charts,
) => {
  return Object.values(filters)
    .filter(filter => filter.chartId !== chartId)
    .reduce(
      (acc, filter) =>
        acc.concat(
          selectIndicatorsForChartFromFilter(
            chartId,
            filter,
            datasources[filter.datasourceId] || {},
            charts[chartId],
          ),
        ),
      [],
    );
};
