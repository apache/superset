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
  SET_FILTER_CONFIG_COMPLETE,
  SET_FILTER_SETS_CONFIG_COMPLETE,
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
  return state as NativeFiltersState;
}

export default function nativeFilterReducer(
  state: NativeFiltersState = {
    filters: {},
    filterSets: {},
  },
  action: AnyFilterAction,
) {
  const { filterSets } = state;
  switch (action.type) {
    case HYDRATE_DASHBOARD:
      return {
        filters: action.data.nativeFilters.filters,
        filterSets: action.data.nativeFilters.filterSets,
      };
    case SAVE_FILTER_SETS:
      return {
        ...state,
        filterSets: {
          ...filterSets,
          [action.filtersSetId]: {
            id: action.filtersSetId,
            name: action.name,
            dataMask: action.dataMask,
          },
        },
      };

    case SET_FILTER_CONFIG_COMPLETE:
      return getInitialState({ filterConfig: action.filterConfig, state });

    case SET_FILTER_SETS_CONFIG_COMPLETE:
      return getInitialState({
        filterSetsConfig: action.filterSetsConfig,
        state,
      });

    // TODO handle SET_FILTER_CONFIG_FAIL action
    default:
      return state;
  }
}
