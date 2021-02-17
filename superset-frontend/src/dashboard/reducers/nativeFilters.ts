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
  AnyFilterAction,
  SAVE_FILTER_SETS,
  SET_EXTRA_FORM_DATA,
  SET_FILTER_CONFIG_COMPLETE,
  SET_FILTERS_STATE,
} from 'src/dashboard/actions/nativeFilters';
import { NativeFiltersState, NativeFilterState } from './types';
import { FilterConfiguration } from '../components/nativeFilters/types';

export function getInitialFilterState(id: string): NativeFilterState {
  return {
    id,
    extraFormData: {},
  };
}

export function getInitialState(
  filterConfig: FilterConfiguration,
  prevState: NativeFiltersState,
): NativeFiltersState {
  const filters = {};
  const filtersState = {};
  const state = {
    filters,
    filtersState,
    filterSets: prevState?.filterSets ?? {},
  };
  filterConfig.forEach(filter => {
    const { id } = filter;
    filters[id] = filter;
    filtersState[id] =
      prevState?.filtersState?.[id] || getInitialFilterState(id);
  });
  return state;
}

export default function nativeFilterReducer(
  state: NativeFiltersState = { filters: {}, filtersState: {}, filterSets: {} },
  action: AnyFilterAction,
) {
  const { filters, filtersState, filterSets } = state;
  switch (action.type) {
    case SET_EXTRA_FORM_DATA:
      return {
        ...state,
        filters,
        filtersState: {
          ...filtersState,
          [action.filterId]: {
            ...filtersState[action.filterId],
            extraFormData: action.extraFormData,
            currentState: action.currentState,
          },
        },
      };
    case SAVE_FILTER_SETS:
      return {
        ...state,
        filterSets: {
          ...filterSets,
          [action.filtersSetId]: {
            id: action.filtersSetId,
            name: action.name,
            filtersState: action.filtersState,
          },
        },
      };
    case SET_FILTERS_STATE:
      return {
        ...state,
        filtersState: {
          ...filtersState,
          ...action.filtersState,
        },
      };

    case SET_FILTER_CONFIG_COMPLETE:
      return getInitialState(action.filterConfig, state);

    // TODO handle SET_FILTER_CONFIG_FAIL action
    default:
      return state;
  }
}
