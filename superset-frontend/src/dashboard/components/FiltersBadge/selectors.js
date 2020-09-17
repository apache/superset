import { isNil, get } from 'lodash';
import { getChartIdsInFilterScope } from '../../util/activeDashboardFilters';
import { TIME_FILTER_MAP } from '../../../visualizations/FilterBox/FilterBox';

export const UNSET = 'UNSET';
export const APPLIED = 'APPLIED';
export const INCOMPATIBLE = 'INCOMPATIBLE';

const TIME_GRANULARITY_FIELDS = new Set([
  TIME_FILTER_MAP.granularity,
  TIME_FILTER_MAP.time_grain_sqla,
]);

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

const selectIndicatorsForChartFromFilter = (
  chartId,
  filter,
  filterDataSource,
  appliedColumns,
  rejectedColumns,
) => {
  // filters can be applied (if the filter is compatible with the datasource)
  // or rejected (if the filter is incompatible)
  // or the status can be unknown (if the filter has calculated parameters that we can't analyze)
  const getStatus = column => {
    if (appliedColumns.has(column)) return APPLIED;
    if (rejectedColumns.has(column)) return INCOMPATIBLE;
    return UNSET;
  };

  return Object.keys(filter.columns)
    .filter(column =>
      getChartIdsInFilterScope({ filterScope: filter.scopes[column] }).includes(
        chartId,
      ),
    )
    .map(column => ({
      id: column,
      name: filter.labels[column] || column,
      value: selectIndicatorValue(column, filter, filterDataSource),
      status: getStatus(column),
      path: filter.directPathToFilter,
    }));
};

export const selectIndicatorsForChart = (
  chartId,
  filters,
  datasources,
  charts,
) => {
  const chart = charts[chartId];
  // for now we only need to know which columns are compatible/incompatible,
  // so grab the columns from the applied/rejected filters
  const appliedColumns = new Set(
    get(chart, 'queryResponse.applied_filters', []).map(
      filter => filter.column,
    ),
  );
  const rejectedColumns = new Set(
    get(chart, 'queryResponse.rejected_filters', []).map(
      filter => filter.column,
    ),
  );
  return Object.values(filters)
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
      [],
    );
};
