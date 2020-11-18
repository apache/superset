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
import { Filter } from '../components/nativeFilters/types';
import { dashboardInfoChanged } from './dashboardInfo';

export const CREATE_FILTER_BEGIN = 'CREATE_FILTER_BEGIN';
export const CREATE_FILTER_COMPLETE = 'CREATE_FILTER_COMPLETE';
export const CREATE_FILTER_FAIL = 'CREATE_FILTER_FAIL';
export const EDIT_FILTER_FAIL = 'EDIT_FILTER_FAIL';

const updateDashboard = (filter: Filter, id: string, metadata: any) => {
  return SupersetClient.put({
    endpoint: `/api/v1/dashboard/${id}`,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      json_metadata: JSON.stringify({
        ...metadata,
        filter_configuration: [
          ...(metadata.filter_configuration || []),
          filter,
        ],
      }),
    }),
  });
};

export interface EditFilterAction {
  type: typeof EDIT_FILTER;
  filter: Filter;
}

export interface CreateFilterBeginAction {
  type: typeof CREATE_FILTER_BEGIN;
  filter: Filter;
}
export interface CreateFilterCompleteAction {
  type: typeof CREATE_FILTER_COMPLETE;
  filter: Filter;
}
export interface CreateFilterFailAction {
  type: typeof CREATE_FILTER_FAIL;
  filter: Filter;
}
export const createFilter = (filter: Filter) => async (
  dispatch: Dispatch,
  getState: () => any,
) => {
  // start
  dispatch({
    type: CREATE_FILTER_BEGIN,
    filter,
  });
  // make api request
  const { id, metadata } = getState().dashboardInfo;
  try {
    const response = await updateDashboard(filter, id, metadata);
    dispatch(
      dashboardInfoChanged({
        metadata: JSON.parse(response.json.result.json_metadata),
      }),
    );
    dispatch({ type: CREATE_FILTER_COMPLETE, filter });
  } catch (err) {
    dispatch({ type: CREATE_FILTER_FAIL, filter });
  }
};

export const EDIT_FILTER = 'EDIT_FILTER';
export const editFilter = (filter: Filter) => async (
  dispatch: Dispatch,
  getState: () => any,
) => {
  dispatch({
    type: EDIT_FILTER,
    filter,
  });
  const { id, metadata } = getState().dashboardInfo;
  try {
    const response = await updateDashboard(filter, id, metadata);
    console.log('response', response)
    dispatch(
      dashboardInfoChanged({
        metadata: JSON.parse(response.json.result.json_metadata),
      }),
    );
  } catch (err) {
    console.log('err', err);
    //dispatch({ type: EDIT_FILTER_FAIL, filter });
  }
};

export const DELETE_FILTER = 'DELETE_FILTER';
export const deleteFilter = (filter: Filter) => ({
  type: DELETE_FILTER,
  filter,
});

// wraps a value in an array if necessary.
function toArray<T>(value: T | T[] | null): T[] | null {
  if (Array.isArray(value)) return value;
  if (value == null) return null;
  return [value];
}

export const SELECT_FILTER_OPTION = 'SELECT_FILTER_OPTION';
export interface SelectFilterOptionAction {
  type: typeof SELECT_FILTER_OPTION;
  filterId: string;
  selectedValues: string[] | null;
}

/**
 * Sets the selected option(s) for a given filter
 * @param filterId the id of the native filter
 * @param values the selected options values
 */
export function selectFilterOption(
  filterId: string,
  values: string | string[] | null,
): SelectFilterOptionAction {
  return {
    type: SELECT_FILTER_OPTION,
    filterId,
    selectedValues: toArray(values),
  };
}
