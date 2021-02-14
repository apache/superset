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
import {
  UPDATE_EXTRA_FORM_DATA,
  AnyFilterAction,
  SET_FILTER_CONFIG_COMPLETE,
  UpdateExtraFormData,
} from 'src/dashboard/actions/nativeFilters';
import { NativeFiltersState, FilterState, FiltersState } from './types';
import { FilterConfiguration } from '../components/nativeFilters/types';

export function getInitialFilterState(id: string): FilterState {
  return {
    id,
    extraFormData: {},
    currentState: {},
  };
}

export function getInitialState(
  filterConfig: FilterConfiguration,
  prevFiltersState: FiltersState = { native: {}, cross: {}, privateData: {} },
): NativeFiltersState {
  const filters = {};
  const filtersState = { ...prevFiltersState };
  const state = { filters, filtersState };
  filterConfig.forEach(filter => {
    const { id } = filter;
    filters[id] = filter;
    filtersState.native[id] =
      prevFiltersState?.native[id] ?? getInitialFilterState(id);
  });
  return state;
}

const getUnitState = (
  unitName: string,
  action: UpdateExtraFormData,
  filtersState: FiltersState,
) => {
  if (action[unitName])
    return {
      ...filtersState[unitName],
      [action.filterId]: {
        ...filtersState[unitName][action.filterId],
        ...action[unitName],
      },
    };
  return { ...filtersState[unitName] };
};

export default function nativeFilterReducer(
  state: NativeFiltersState = {
    filters: {},
    filtersState: { native: {}, cross: {}, privateData: {} },
  },
  action: AnyFilterAction,
) {
  const { filters, filtersState } = state;
  switch (action.type) {
    case UPDATE_EXTRA_FORM_DATA:
      return {
        filters,
        filtersState: {
          ...filtersState,
          native: getUnitState('native', action, filtersState),
          cross: getUnitState('cross', action, filtersState),
          privateData: getUnitState('privateData', action, filtersState),
        },
      };

    case SET_FILTER_CONFIG_COMPLETE:
      return getInitialState(action.filterConfig, filtersState);

    // TODO handle SET_FILTER_CONFIG_FAIL action
    default:
      return state;
  }
}
