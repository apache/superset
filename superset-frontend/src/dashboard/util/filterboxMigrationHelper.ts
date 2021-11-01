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
import shortid from 'shortid';
import { find, isEmpty } from 'lodash';

import {
  Filter,
  NativeFilterType,
} from 'src/dashboard/components/nativeFilters/types';
import {
  FILTER_CONFIG_ATTRIBUTES,
  TIME_FILTER_LABELS,
  TIME_FILTER_MAP,
} from 'src/explore/constants';
import { DASHBOARD_FILTER_SCOPE_GLOBAL } from 'src/dashboard/reducers/dashboardFilters';
import { TimeGranularity } from '@superset-ui/core';
import { getChartIdsInFilterScope } from './activeDashboardFilters';
import getFilterConfigsFromFormdata from './getFilterConfigsFromFormdata';

interface FilterConfig {
  asc: boolean;
  clearable: boolean;
  column: string;
  defaultValue?: any;
  key: string;
  label?: string;
  metric: string;
  multiple: boolean;
}

interface SliceData {
  slice_id: number;
  form_data: {
    adhoc_filters?: [];
    datasource: string;
    date_filter?: boolean;
    filter_configs?: FilterConfig[];
    granularity?: string;
    granularity_sqla?: string;
    time_grain_sqla?: string;
    time_range?: string;
    druid_time_origin?: string;
    show_druid_time_granularity?: boolean;
    show_druid_time_origin?: boolean;
    show_sqla_time_column?: boolean;
    show_sqla_time_granularity?: boolean;
    viz_type: string;
  };
}

interface FilterScopeType {
  scope: string[];
  immune: number[];
}

interface FilterScopesMetadata {
  [key: string]: {
    [key: string]: FilterScopeType;
  };
}

interface PreselectedFilterColumn {
  [key: string]: boolean | string | number | string[] | number[];
}

interface PreselectedFiltersMeatadata {
  [key: string]: PreselectedFilterColumn;
}

interface FilterBoxToFilterComponentMap {
  [key: string]: {
    [key: string]: string;
  };
}

interface FilterBoxDependencyMap {
  [key: string]: {
    [key: string]: number[];
  };
}

enum FILTER_COMPONENT_FILTER_TYPES {
  FILTER_TIME = 'filter_time',
  FILTER_TIMEGRAIN = 'filter_timegrain',
  FILTER_TIMECOLUMN = 'filter_timecolumn',
  FILTER_SELECT = 'filter_select',
  FILTER_RANGE = 'filter_range',
}

const getPreselectedValuesFromDashboard = (
  preselectedFilters: PreselectedFiltersMeatadata,
) => (filterKey: string, column: string) => {
  if (preselectedFilters[filterKey] && preselectedFilters[filterKey][column]) {
    // overwrite default values by dashboard default_filters
    return preselectedFilters[filterKey][column];
  }
  return null;
};

const getFilterBoxDefaultValues = (config: FilterConfig) => {
  let defaultValues = config[FILTER_CONFIG_ATTRIBUTES.DEFAULT_VALUE];

  // treat empty string as null (no default value)
  if (defaultValues === '') {
    defaultValues = null;
  }

  // defaultValue could be ; separated values,
  // could be null or ''
  if (defaultValues && config[FILTER_CONFIG_ATTRIBUTES.MULTIPLE]) {
    defaultValues = config.defaultValue.split(';');
  }

  return defaultValues;
};

const setValuesInArray = (value1: any, value2: any) => {
  if (!isEmpty(value1)) {
    return [value1];
  }
  if (!isEmpty(value2)) {
    return [value2];
  }
  return [];
};

const getFilterboxDependencies = (filterScopes: FilterScopesMetadata) => {
  const filterFieldsDependencies: FilterBoxDependencyMap = {};
  const filterChartIds: number[] = Object.keys(filterScopes).map(key =>
    parseInt(key, 10),
  );
  Object.entries(filterScopes).forEach(([key, filterFields]) => {
    filterFieldsDependencies[key] = {};
    Object.entries(filterFields).forEach(([filterField, filterScope]) => {
      filterFieldsDependencies[key][filterField] = getChartIdsInFilterScope({
        filterScope,
      }).filter(
        chartId => filterChartIds.includes(chartId) && String(chartId) !== key,
      );
    });
  });
  return filterFieldsDependencies;
};

export default function getNativeFilterConfig(
  chartData: SliceData[] = [],
  filterScopes: FilterScopesMetadata = {},
  preselectFilters: PreselectedFiltersMeatadata = {},
): Filter[] {
  const filterConfig: Filter[] = [];
  const filterBoxToFilterComponentMap: FilterBoxToFilterComponentMap = {};

  chartData.forEach(slice => {
    const key = String(slice.slice_id);

    if (slice.form_data.viz_type === 'filter_box') {
      filterBoxToFilterComponentMap[key] = {};
      const configs = getFilterConfigsFromFormdata(slice.form_data);
      let { columns } = configs;
      if (preselectFilters[key]) {
        Object.keys(columns).forEach(col => {
          if (preselectFilters[key][col]) {
            columns = {
              ...columns,
              [col]: preselectFilters[key][col],
            };
          }
        });
      }

      const scopesByChartId = Object.keys(columns).reduce((map, column) => {
        const scopeSettings = {
          ...filterScopes[key],
        };
        const { scope, immune }: FilterScopeType = {
          ...DASHBOARD_FILTER_SCOPE_GLOBAL,
          ...scopeSettings[column],
        };

        return {
          ...map,
          [column]: {
            scope,
            immune,
          },
        };
      }, {});

      const {
        adhoc_filters = [],
        datasource = '',
        date_filter = false,
        druid_time_origin,
        filter_configs = [],
        granularity,
        granularity_sqla,
        show_druid_time_granularity = false,
        show_druid_time_origin = false,
        show_sqla_time_column = false,
        show_sqla_time_granularity = false,
        time_grain_sqla,
        time_range,
      } = slice.form_data;

      const getDashboardDefaultValues = getPreselectedValuesFromDashboard(
        preselectFilters,
      );

      if (date_filter) {
        const { scope, immune }: FilterScopeType =
          scopesByChartId[TIME_FILTER_MAP.time_range] ||
          DASHBOARD_FILTER_SCOPE_GLOBAL;
        const timeRangeFilter: Filter = {
          id: `NATIVE_FILTER-${shortid.generate()}`,
          description: 'time range filter',
          controlValues: {},
          name: TIME_FILTER_LABELS.time_range,
          filterType: FILTER_COMPONENT_FILTER_TYPES.FILTER_TIME,
          targets: [{}],
          cascadeParentIds: [],
          defaultDataMask: {},
          type: NativeFilterType.NATIVE_FILTER,
          scope: {
            rootPath: scope,
            excluded: immune,
          },
        };
        filterBoxToFilterComponentMap[key][TIME_FILTER_MAP.time_range] =
          timeRangeFilter.id;
        const dashboardDefaultValues =
          getDashboardDefaultValues(key, TIME_FILTER_MAP.time_range) ||
          time_range;
        if (!isEmpty(dashboardDefaultValues)) {
          timeRangeFilter.defaultDataMask = {
            extraFormData: { time_range: dashboardDefaultValues as string },
            filterState: { value: dashboardDefaultValues },
          };
        }
        filterConfig.push(timeRangeFilter);

        if (show_sqla_time_granularity) {
          const { scope, immune }: FilterScopeType =
            scopesByChartId[TIME_FILTER_MAP.time_grain_sqla] ||
            DASHBOARD_FILTER_SCOPE_GLOBAL;
          const timeGrainFilter: Filter = {
            id: `NATIVE_FILTER-${shortid.generate()}`,
            controlValues: {},
            description: 'time grain filter',
            name: TIME_FILTER_LABELS.time_grain_sqla,
            filterType: FILTER_COMPONENT_FILTER_TYPES.FILTER_TIMEGRAIN,
            targets: [
              {
                datasetId: parseInt(datasource.split('__')[0], 10),
              },
            ],
            cascadeParentIds: [],
            defaultDataMask: {},
            type: NativeFilterType.NATIVE_FILTER,
            scope: {
              rootPath: scope,
              excluded: immune,
            },
          };
          filterBoxToFilterComponentMap[key][TIME_FILTER_MAP.time_grain_sqla] =
            timeGrainFilter.id;
          const dashboardDefaultValues = getDashboardDefaultValues(
            key,
            TIME_FILTER_MAP.time_grain_sqla,
          );
          if (!isEmpty(dashboardDefaultValues)) {
            timeGrainFilter.defaultDataMask = {
              extraFormData: {
                time_grain_sqla: (dashboardDefaultValues ||
                  time_grain_sqla) as TimeGranularity,
              },
              filterState: {
                value: setValuesInArray(
                  dashboardDefaultValues,
                  time_grain_sqla,
                ),
              },
            };
          }
          filterConfig.push(timeGrainFilter);
        }

        if (show_sqla_time_column) {
          const { scope, immune }: FilterScopeType =
            scopesByChartId[TIME_FILTER_MAP.granularity_sqla] ||
            DASHBOARD_FILTER_SCOPE_GLOBAL;
          const timeColumnFilter: Filter = {
            id: `NATIVE_FILTER-${shortid.generate()}`,
            description: 'time column filter',
            controlValues: {},
            name: TIME_FILTER_LABELS.granularity_sqla,
            filterType: FILTER_COMPONENT_FILTER_TYPES.FILTER_TIMECOLUMN,
            targets: [
              {
                datasetId: parseInt(datasource.split('__')[0], 10),
              },
            ],
            cascadeParentIds: [],
            defaultDataMask: {},
            type: NativeFilterType.NATIVE_FILTER,
            scope: {
              rootPath: scope,
              excluded: immune,
            },
          };
          filterBoxToFilterComponentMap[key][TIME_FILTER_MAP.granularity_sqla] =
            timeColumnFilter.id;
          const dashboardDefaultValues = getDashboardDefaultValues(
            key,
            TIME_FILTER_MAP.granularity_sqla,
          );
          if (!isEmpty(dashboardDefaultValues)) {
            timeColumnFilter.defaultDataMask = {
              extraFormData: {
                granularity_sqla: (dashboardDefaultValues ||
                  granularity_sqla) as string,
              },
              filterState: {
                value: setValuesInArray(
                  dashboardDefaultValues,
                  granularity_sqla,
                ),
              },
            };
          }
          filterConfig.push(timeColumnFilter);
        }

        if (show_druid_time_granularity) {
          const { scope, immune }: FilterScopeType =
            scopesByChartId[TIME_FILTER_MAP.granularity] ||
            DASHBOARD_FILTER_SCOPE_GLOBAL;
          const druidGranularityFilter: Filter = {
            id: `NATIVE_FILTER-${shortid.generate()}`,
            description: 'time grain filter',
            controlValues: {},
            name: TIME_FILTER_LABELS.granularity,
            filterType: FILTER_COMPONENT_FILTER_TYPES.FILTER_TIMEGRAIN,
            targets: [
              {
                datasetId: parseInt(datasource.split('__')[0], 10),
              },
            ],
            cascadeParentIds: [],
            defaultDataMask: {},
            type: NativeFilterType.NATIVE_FILTER,
            scope: {
              rootPath: scope,
              excluded: immune,
            },
          };
          filterBoxToFilterComponentMap[key][TIME_FILTER_MAP.granularity] =
            druidGranularityFilter.id;
          const dashboardDefaultValues = getDashboardDefaultValues(
            key,
            TIME_FILTER_MAP.granularity,
          );
          if (!isEmpty(dashboardDefaultValues)) {
            druidGranularityFilter.defaultDataMask = {
              extraFormData: {
                granularity_sqla: (dashboardDefaultValues ||
                  granularity) as string,
              },
              filterState: {
                value: setValuesInArray(dashboardDefaultValues, granularity),
              },
            };
          }
          filterConfig.push(druidGranularityFilter);
        }

        if (show_druid_time_origin) {
          const { scope, immune }: FilterScopeType =
            scopesByChartId[TIME_FILTER_MAP.druid_time_origin] ||
            DASHBOARD_FILTER_SCOPE_GLOBAL;
          const druidOriginFilter: Filter = {
            id: `NATIVE_FILTER-${shortid.generate()}`,
            description: 'time column filter',
            controlValues: {},
            name: TIME_FILTER_LABELS.druid_time_origin,
            filterType: FILTER_COMPONENT_FILTER_TYPES.FILTER_TIMECOLUMN,
            targets: [
              {
                datasetId: parseInt(datasource.split('__')[0], 10),
              },
            ],
            cascadeParentIds: [],
            defaultDataMask: {},
            type: NativeFilterType.NATIVE_FILTER,
            scope: {
              rootPath: scope,
              excluded: immune,
            },
          };
          filterBoxToFilterComponentMap[key][
            TIME_FILTER_MAP.druid_time_origin
          ] = druidOriginFilter.id;
          const dashboardDefaultValues = getDashboardDefaultValues(
            key,
            TIME_FILTER_MAP.druid_time_origin,
          );
          if (!isEmpty(dashboardDefaultValues)) {
            druidOriginFilter.defaultDataMask = {
              extraFormData: {
                granularity_sqla: (dashboardDefaultValues ||
                  druid_time_origin) as string,
              },
              filterState: {
                value: setValuesInArray(
                  dashboardDefaultValues,
                  druid_time_origin,
                ),
              },
            };
          }
          filterConfig.push(druidOriginFilter);
        }
      }

      filter_configs.forEach(config => {
        const { scope, immune }: FilterScopeType =
          scopesByChartId[config.column] || DASHBOARD_FILTER_SCOPE_GLOBAL;
        const entry: Filter = {
          id: `NATIVE_FILTER-${shortid.generate()}`,
          description: '',
          controlValues: {
            enableEmptyFilter: !config[FILTER_CONFIG_ATTRIBUTES.CLEARABLE],
            defaultToFirstItem: false,
            inverseSelection: false,
            multiSelect: config[FILTER_CONFIG_ATTRIBUTES.MULTIPLE],
            sortAscending: config[FILTER_CONFIG_ATTRIBUTES.SORT_ASCENDING],
          },
          name: config.label || config.column,
          filterType: FILTER_COMPONENT_FILTER_TYPES.FILTER_SELECT,
          targets: [
            {
              datasetId: parseInt(datasource.split('__')[0], 10),
              column: {
                name: config.column,
              },
            },
          ],
          cascadeParentIds: [],
          defaultDataMask: {},
          type: NativeFilterType.NATIVE_FILTER,
          scope: {
            rootPath: scope,
            excluded: immune,
          },
          adhoc_filters,
          sortMetric: config[FILTER_CONFIG_ATTRIBUTES.SORT_METRIC],
          time_range,
        };
        filterBoxToFilterComponentMap[key][config.column] = entry.id;
        const defaultValues =
          getDashboardDefaultValues(key, config.column) ||
          getFilterBoxDefaultValues(config);
        if (!isEmpty(defaultValues)) {
          entry.defaultDataMask = {
            extraFormData: {
              filters: [{ col: config.column, op: 'IN', val: defaultValues }],
            },
            filterState: { value: defaultValues },
          };
        }
        filterConfig.push(entry);
      });
    }
  });

  const dependencies: FilterBoxDependencyMap = getFilterboxDependencies(
    filterScopes,
  );
  Object.entries(dependencies).forEach(([key, filterFields]) => {
    Object.entries(filterFields).forEach(([field, childrenChartIds]) => {
      const parentComponentId = filterBoxToFilterComponentMap[key][field];
      childrenChartIds.forEach(childrenChartId => {
        const childComponentIds = Object.values(
          filterBoxToFilterComponentMap[childrenChartId],
        );
        childComponentIds.forEach(childComponentId => {
          const childComponent = find(
            filterConfig,
            ({ id }) => id === childComponentId,
          );
          if (
            childComponent &&
            // time related filter components don't have parent
            [
              FILTER_COMPONENT_FILTER_TYPES.FILTER_SELECT,
              FILTER_COMPONENT_FILTER_TYPES.FILTER_RANGE,
            ].includes(
              childComponent.filterType as FILTER_COMPONENT_FILTER_TYPES,
            )
          ) {
            childComponent.cascadeParentIds ||= [];
            childComponent.cascadeParentIds.push(parentComponentId);
          }
        });
      });
    });
  });

  return filterConfig;
}
