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
import { DASHBOARD_ROOT_ID } from '../util/constants';
import {
  ADD_FILTER,
  REMOVE_FILTER,
  CHANGE_FILTER,
  UPDATE_DIRECT_PATH_TO_FILTER,
} from '../actions/dashboardFilters';
import { TIME_RANGE } from '../../visualizations/FilterBox/FilterBox';
import getFilterConfigsFromFormdata from '../util/getFilterConfigsFromFormdata';
import { buildFilterColorMap } from '../util/dashboardFiltersColorMap';
import { buildActiveFilters } from '../util/activeDashboardFilters';

export const dashboardFilter = {
  chartId: 0,
  componentId: '',
  directPathToFilter: [],
  scope: DASHBOARD_ROOT_ID,
  isDateFilter: false,
  isInstantFilter: true,
  columns: {},
};

export default function dashboardFiltersReducer(dashboardFilters = {}, action) {
  const actionHandlers = {
    [ADD_FILTER]() {
      const { chartId, component, form_data } = action;
      const { columns, labels } = getFilterConfigsFromFormdata(form_data);
      const directPathToFilter = component
        ? (component.parents || []).slice().concat(component.id)
        : [];

      const newFilter = {
        ...dashboardFilter,
        chartId,
        componentId: component.id,
        directPathToFilter,
        columns,
        labels,
        isInstantFilter: !!form_data.instant_filtering,
        isDateFilter: Object.keys(columns).includes(TIME_RANGE),
      };

      return newFilter;
    },

    [CHANGE_FILTER](state) {
      const { newSelectedValues, merge } = action;
      const updatedColumns = Object.keys(newSelectedValues).reduce(
        (columns, name) => {
          // override existed column value, or add new column name
          if (!merge || !(name in columns)) {
            return {
              ...columns,
              [name]: newSelectedValues[name],
            };
          }

          return {
            ...columns,
            [name]: [...columns[name], ...newSelectedValues[name]],
          };
        },
        { ...state.columns },
      );

      return {
        ...state,
        columns: updatedColumns,
      };
    },

    [UPDATE_DIRECT_PATH_TO_FILTER](state) {
      const { path } = action;
      return {
        ...state,
        directPathToFilter: path,
      };
    },
  };

  if (action.type === REMOVE_FILTER) {
    const { chartId } = action;
    const { [chartId]: deletedFilter, ...updatedFilters } = dashboardFilters;
    buildActiveFilters(updatedFilters);
    buildFilterColorMap(updatedFilters);

    return updatedFilters;
  } else if (action.type in actionHandlers) {
    const updatedFilters = {
      ...dashboardFilters,
      [action.chartId]: actionHandlers[action.type](
        dashboardFilters[action.chartId],
      ),
    };
    buildActiveFilters(updatedFilters);
    buildFilterColorMap(updatedFilters);

    return updatedFilters;
  }

  return dashboardFilters;
}
