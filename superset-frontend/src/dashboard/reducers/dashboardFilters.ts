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
/* eslint-disable camelcase */
import { JsonValue } from '@superset-ui/core';
import {
  CHANGE_FILTER,
  UPDATE_DIRECT_PATH_TO_FILTER,
  UPDATE_LAYOUT_COMPONENTS,
  UPDATE_DASHBOARD_FILTERS_SCOPE,
} from '../actions/dashboardFilters';
import { HYDRATE_DASHBOARD } from '../actions/hydrate';
import { DASHBOARD_ROOT_ID } from '../util/constants';
import { buildActiveFilters } from '../util/activeDashboardFilters';
import { getChartIdAndColumnFromFilterKey } from '../util/getDashboardFilterKey';
import { LayoutItem } from '../types';

interface FilterScope {
  scope: string[];
  immune: number[];
}

interface DashboardFilterEntry {
  chartId: number | null;
  componentId: string | null;
  filterName: string | null;
  datasourceId: number | null;
  directPathToFilter: string[];
  isDateFilter: boolean;
  isInstantFilter: boolean;
  columns: Record<string, JsonValue[] | JsonValue>;
  labels: Record<string, string>;
  scopes: Record<string, FilterScope>;
}

export interface DashboardFiltersState {
  [chartId: string]: DashboardFilterEntry;
}

interface DashboardFilterAction {
  type: string;
  chartId?: number;
  newSelectedValues?: Record<string, JsonValue[] | JsonValue>;
  merge?: boolean;
  path?: string[];
  components?: Record<string, LayoutItem>;
  scopes?: Record<string, FilterScope>;
  data?: {
    dashboardFilters: DashboardFiltersState;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export const DASHBOARD_FILTER_SCOPE_GLOBAL: FilterScope = {
  scope: [DASHBOARD_ROOT_ID],
  immune: [],
};

export const dashboardFilter: DashboardFilterEntry = {
  chartId: null,
  componentId: null,
  filterName: null,
  datasourceId: null,
  directPathToFilter: [],
  isDateFilter: false,
  isInstantFilter: true,
  columns: {},
  labels: {},
  scopes: {},
};

const CHANGE_FILTER_VALUE_ACTIONS: string[] = [CHANGE_FILTER];

export default function dashboardFiltersReducer(
  dashboardFilters: DashboardFiltersState = {},
  action: DashboardFilterAction,
): DashboardFiltersState {
  const actionHandlers: Record<
    string,
    (state: DashboardFilterEntry) => DashboardFilterEntry
  > = {
    [CHANGE_FILTER](state: DashboardFilterEntry): DashboardFilterEntry {
      const { newSelectedValues, merge } = action;
      if (!newSelectedValues) return state;
      const updatedColumns = Object.keys(newSelectedValues).reduce(
        (columns: Record<string, JsonValue[] | JsonValue>, name: string) => {
          // override existed column value, or add new column name
          if (!merge || !(name in columns)) {
            return {
              ...columns,
              [name]: newSelectedValues[name],
            };
          }

          const existingVal = columns[name];
          const newVal = newSelectedValues[name];
          return {
            ...columns,
            [name]: [
              ...(Array.isArray(existingVal) ? existingVal : []),
              ...(Array.isArray(newVal) ? newVal : []),
            ],
          };
        },
        { ...state.columns },
      );

      return {
        ...state,
        columns: updatedColumns,
      };
    },

    [UPDATE_DIRECT_PATH_TO_FILTER](
      state: DashboardFilterEntry,
    ): DashboardFilterEntry {
      const { path } = action;
      return {
        ...state,
        directPathToFilter: path || [],
      };
    },
  };

  if (action.type === UPDATE_LAYOUT_COMPONENTS) {
    buildActiveFilters({
      dashboardFilters: dashboardFilters as Parameters<
        typeof buildActiveFilters
      >[0]['dashboardFilters'],
      components: action.components,
    });
    return dashboardFilters;
  }
  if (action.type === UPDATE_DASHBOARD_FILTERS_SCOPE) {
    const allDashboardFiltersScope = action.scopes;
    if (!allDashboardFiltersScope) return dashboardFilters;
    // update filter scope for each filter field
    const updatedFilters = Object.entries(allDashboardFiltersScope).reduce(
      (map: DashboardFiltersState, entry) => {
        const [filterKey, { scope, immune }] = entry as [string, FilterScope];
        const { chartId, column } = getChartIdAndColumnFromFilterKey(filterKey);
        const chartIdStr = String(chartId);
        const scopes = {
          ...map[chartIdStr].scopes,
          [column]: {
            scope,
            immune,
          },
        };
        return {
          ...map,
          [chartIdStr]: {
            ...map[chartIdStr],
            scopes,
          },
        };
      },
      dashboardFilters,
    );

    buildActiveFilters({
      dashboardFilters: updatedFilters as Parameters<
        typeof buildActiveFilters
      >[0]['dashboardFilters'],
    });
    return updatedFilters;
  }
  if (action.type === HYDRATE_DASHBOARD) {
    return action.data?.dashboardFilters ?? {};
  }

  if (action.type in actionHandlers) {
    const chartIdStr = String(action.chartId);
    const updatedFilters: DashboardFiltersState = {
      ...dashboardFilters,
      [chartIdStr]: actionHandlers[action.type](dashboardFilters[chartIdStr]),
    };
    if (CHANGE_FILTER_VALUE_ACTIONS.includes(action.type)) {
      buildActiveFilters({
        dashboardFilters: updatedFilters as Parameters<
          typeof buildActiveFilters
        >[0]['dashboardFilters'],
      });
    }

    return updatedFilters;
  }

  return dashboardFilters;
}
