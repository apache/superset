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
// util function to make sure filter is a valid slice in current dashboard
function isValidFilter(getState, chartId) {
  return getState().dashboardState.sliceIds.includes(chartId);
}

export const ADD_FILTER = 'ADD_FILTER';
export function addFilter(chartId, component, form_data) {
  return (dispatch, getState) => {
    if (isValidFilter(getState, chartId)) {
      return dispatch({ type: ADD_FILTER, chartId, component, form_data });
    }
    return getState().dashboardFilters;
  };
}

export const REMOVE_FILTER = 'REMOVE_FILTER';
export function removeFilter(chartId) {
  return (dispatch, getState) => {
    if (isValidFilter(getState, chartId)) {
      return dispatch({ type: REMOVE_FILTER, chartId });
    }
    return getState().dashboardFilters;
  };
}

export const CHANGE_FILTER = 'CHANGE_FILTER';
export function changeFilter(chartId, newSelectedValues, merge) {
  return (dispatch, getState) => {
    if (isValidFilter(getState, chartId)) {
      return dispatch({
        type: CHANGE_FILTER,
        chartId,
        newSelectedValues,
        merge,
      });
    }
    return getState().dashboardFilters;
  };
}

export const UPDATE_DIRECT_PATH_TO_FILTER = 'UPDATE_DIRECT_PATH_TO_FILTER';
export function updateDirectPathToFilter(chartId, path) {
  return (dispatch, getState) => {
    if (isValidFilter(getState, chartId)) {
      return dispatch({ type: UPDATE_DIRECT_PATH_TO_FILTER, chartId, path });
    }
    return getState().dashboardFilters;
  };
}
