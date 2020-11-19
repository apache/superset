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

import { SupersetClient } from '@superset-ui/core';
import { Dispatch } from 'redux';
import { FilterConfiguration } from '../components/nativeFilters/types';
import { dashboardInfoChanged } from './dashboardInfo';

export const SET_FILTER_CONFIG_BEGIN = 'SET_FILTER_CONFIG_BEGIN';
export interface SetFilterConfigBegin {
  type: typeof SET_FILTER_CONFIG_BEGIN;
  filterConfig: FilterConfiguration;
}
export const SET_FILTER_CONFIG_COMPLETE = 'SET_FILTER_CONFIG_COMPLETE';
export interface SetFilterConfigComplete {
  type: typeof SET_FILTER_CONFIG_COMPLETE;
  filterConfig: FilterConfiguration;
}
export const SET_FILTER_CONFIG_FAIL = 'SET_FILTER_CONFIG_FAIL';
export interface SetFilterConfigFail {
  type: typeof SET_FILTER_CONFIG_FAIL;
  filterConfig: FilterConfiguration;
}

export const SET_FILTER_STATE = 'SET_FILTER_STATE';
export interface SetFilterState {
  type: typeof SET_FILTER_STATE;
  filterConfig: FilterConfiguration;
}

export const setFilterConfiguration = (
  filterConfig: FilterConfiguration,
) => async (dispatch: Dispatch, getState: () => any) => {
  dispatch({
    type: SET_FILTER_CONFIG_BEGIN,
    filterConfig,
  });
  const { id, metadata } = getState().dashboardInfo;
  try {
    const response = await SupersetClient.put({
      endpoint: `/api/v1/dashboard/${id}`,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json_metadata: JSON.stringify({
          ...metadata,
          filter_configuration: filterConfig,
        }),
      }),
    });
    dispatch(
      dashboardInfoChanged({
        metadata: JSON.parse(response.json.result.json_metadata),
      }),
    );
    dispatch({
      type: SET_FILTER_CONFIG_COMPLETE,
      filterConfig,
    });
  } catch (err) {
    dispatch({ type: SET_FILTER_CONFIG_FAIL, filterConfig });
  }
};

// wraps a value in an array if necessary.
function toArray<T>(value: T | T[] | null): T[] | null {
  if (Array.isArray(value)) return value;
  if (value == null) return null;
  return [value];
}

export const SELECT_FILTER_OPTION = 'SELECT_FILTER_OPTION';
export interface SelectFilterOption {
  type: typeof SELECT_FILTER_OPTION;
  filterId: string;
  selectedValues: string[] | null;
}

export function setFilterState(filtersList: Array<any>) {
  console.log('filterList action', filtersList)
  return {
    type: SET_FILTER_STATE,
    filtersList,
  };
}
/**
 * Sets the selected option(s) for a given filter
 * @param filterId the id of the native filter
 * @param values the selected options values
 */
export function selectFilterOption(
  filterId: string,
  values: string | string[] | null,
): SelectFilterOption {
  return {
    type: SELECT_FILTER_OPTION,
    filterId,
    selectedValues: toArray(values),
  };
}

export type AnyFilterAction =
  | SetFilterConfigBegin
  | SetFilterConfigComplete
  | SetFilterConfigFail
  | SelectFilterOption
  | SetFilterState;
