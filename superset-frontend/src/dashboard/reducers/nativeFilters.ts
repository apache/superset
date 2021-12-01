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
  SET_FILTER_CONFIG_COMPLETE,
  SET_IN_SCOPE_STATUS_OF_FILTERS,
  SET_FILTER_SETS_COMPLETE,
  SET_FOCUSED_NATIVE_FILTER,
  UNSET_FOCUSED_NATIVE_FILTER,
} from 'src/dashboard/actions/nativeFilters';
import { FilterSet, NativeFiltersState } from './types';
import { FilterConfiguration } from '../components/nativeFilters/types';
import { HYDRATE_DASHBOARD } from '../actions/hydrate';

export function getInitialState({
  filterSetsConfig,
  filterConfig,
  state: prevState,
}: {
  filterSetsConfig?: FilterSet[];
  filterConfig?: FilterConfiguration;
  state?: NativeFiltersState;
}): NativeFiltersState {
  const state: Partial<NativeFiltersState> = {};

  const filters = {};
  if (filterConfig) {
    filterConfig.forEach(filter => {
      const { id } = filter;
      filters[id] = filter;
    });
    state.filters = filters;
  } else {
    state.filters = prevState?.filters ?? {};
  }

  if (filterSetsConfig) {
    const filterSets = {};
    filterSetsConfig.forEach(filtersSet => {
      const { id } = filtersSet;
      filterSets[id] = filtersSet;
    });
    state.filterSets = filterSets;
  } else {
    state.filterSets = prevState?.filterSets ?? {};
  }
  state.focusedFilterId = undefined;
  return state as NativeFiltersState;
}

export default function nativeFilterReducer(
  state: NativeFiltersState = {
    filters: {},
    filterSets: {},
  },
  action: AnyFilterAction,
) {
  switch (action.type) {
    case HYDRATE_DASHBOARD:
      return {
        filters: action.data.nativeFilters.filters,
        filterSets: action.data.nativeFilters.filterSets,
      };

    case SET_FILTER_CONFIG_COMPLETE:
    case SET_IN_SCOPE_STATUS_OF_FILTERS:
      return getInitialState({ filterConfig: action.filterConfig, state });

    case SET_FILTER_SETS_COMPLETE:
      return getInitialState({
        filterSetsConfig: action.filterSets,
        state,
      });

    case SET_FOCUSED_NATIVE_FILTER:
      return {
        ...state,
        focusedFilterId: action.id,
      };

    case UNSET_FOCUSED_NATIVE_FILTER:
      return {
        ...state,
        focusedFilterId: undefined,
      };
    // TODO handle SET_FILTER_CONFIG_FAIL action
    default:
      return state;
  }
}
