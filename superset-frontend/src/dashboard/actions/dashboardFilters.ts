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
import { JsonObject } from '@superset-ui/core';
import { Dispatch } from 'redux';
import { DashboardLayout, GetState } from '../types';

// util function to make sure filter is a valid slice in current dashboard
function isValidFilter(getState: GetState, chartId: number): boolean {
  return getState().dashboardState.sliceIds.includes(chartId);
}

export const CHANGE_FILTER = 'CHANGE_FILTER';

interface ChangeFilterAction {
  type: typeof CHANGE_FILTER;
  chartId: number;
  newSelectedValues: JsonObject;
  merge: boolean;
  components: DashboardLayout;
}

export function changeFilter(
  chartId: number,
  newSelectedValues: JsonObject,
  merge: boolean,
) {
  return (
    dispatch: Dispatch,
    getState: GetState,
  ): ChangeFilterAction | JsonObject => {
    if (isValidFilter(getState, chartId)) {
      const components = getState().dashboardLayout.present;
      return dispatch({
        type: CHANGE_FILTER,
        chartId,
        newSelectedValues,
        merge,
        components,
      } as ChangeFilterAction);
    }
    return getState().dashboardFilters;
  };
}

export const UPDATE_DIRECT_PATH_TO_FILTER = 'UPDATE_DIRECT_PATH_TO_FILTER';

interface UpdateDirectPathToFilterAction {
  type: typeof UPDATE_DIRECT_PATH_TO_FILTER;
  chartId: number;
  path: string[];
}

export function updateDirectPathToFilter(chartId: number, path: string[]) {
  return (
    dispatch: Dispatch,
    getState: GetState,
  ): UpdateDirectPathToFilterAction | JsonObject => {
    if (isValidFilter(getState, chartId)) {
      return dispatch({
        type: UPDATE_DIRECT_PATH_TO_FILTER,
        chartId,
        path,
      } as UpdateDirectPathToFilterAction);
    }
    return getState().dashboardFilters;
  };
}

export const UPDATE_LAYOUT_COMPONENTS = 'UPDATE_LAYOUT_COMPONENTS';

interface UpdateLayoutComponentsAction {
  type: typeof UPDATE_LAYOUT_COMPONENTS;
  components: DashboardLayout;
}

export function updateLayoutComponents(
  components: DashboardLayout,
): (dispatch: Dispatch) => void {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_LAYOUT_COMPONENTS,
      components,
    } as UpdateLayoutComponentsAction);
  };
}

export const UPDATE_DASHBOARD_FILTERS_SCOPE = 'UPDATE_DASHBOARD_FILTERS_SCOPE';

interface UpdateDashboardFiltersScopeAction {
  type: typeof UPDATE_DASHBOARD_FILTERS_SCOPE;
  scopes: JsonObject;
}

export function updateDashboardFiltersScope(
  scopes: JsonObject,
): (dispatch: Dispatch) => void {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_DASHBOARD_FILTERS_SCOPE,
      scopes,
    } as UpdateDashboardFiltersScopeAction);
  };
}
