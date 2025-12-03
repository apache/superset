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
  SET_NATIVE_FILTERS_CONFIG_COMPLETE,
  SET_IN_SCOPE_STATUS_OF_FILTERS,
  SET_FOCUSED_NATIVE_FILTER,
  UNSET_FOCUSED_NATIVE_FILTER,
  SET_HOVERED_NATIVE_FILTER,
  UNSET_HOVERED_NATIVE_FILTER,
  SET_HOVERED_CHART_CUSTOMIZATION,
  UNSET_HOVERED_CHART_CUSTOMIZATION,
  UPDATE_CASCADE_PARENT_IDS,
} from 'src/dashboard/actions/nativeFilters';
import {
  Divider,
  Filter,
  NativeFiltersState,
  ChartCustomization,
  ChartCustomizationDivider,
  Filters,
} from '@superset-ui/core';
import { HYDRATE_DASHBOARD } from '../actions/hydrate';

interface ExtendedNativeFiltersState extends NativeFiltersState {
  hoveredChartCustomizationId?: string;
}

export function getInitialState({
  filterConfig,
  state: prevState,
}: {
  filterConfig?: Array<
    Filter | Divider | ChartCustomization | ChartCustomizationDivider
  >;
  state?: ExtendedNativeFiltersState;
}): ExtendedNativeFiltersState {
  const state: Partial<ExtendedNativeFiltersState> = {};
  if (filterConfig) {
    // Merge new filterConfig with existing filters to preserve items
    // that aren't in the new config (e.g., customizations when updating filters)
    const filters = { ...prevState?.filters } as Filters;
    filterConfig.forEach(filter => {
      const { id } = filter;
      filters[id] = filter;
    });
    state.filters = filters;
  } else {
    state.filters = prevState?.filters ?? {};
  }
  state.focusedFilterId = undefined;
  state.hoveredChartCustomizationId = undefined;
  return state as ExtendedNativeFiltersState;
}

function handleFilterChangesComplete(
  state: ExtendedNativeFiltersState,
  filters: Array<
    Filter | Divider | ChartCustomization | ChartCustomizationDivider
  >,
) {
  const modifiedFilters = { ...state.filters };
  filters.forEach(filter => {
    const existingFilter = state.filters[filter.id];

    modifiedFilters[filter.id] = {
      ...filter,
      chartsInScope:
        'chartsInScope' in filter && filter.chartsInScope !== undefined
          ? filter.chartsInScope
          : existingFilter?.chartsInScope,
      tabsInScope:
        'tabsInScope' in filter && filter.tabsInScope !== undefined
          ? filter.tabsInScope
          : existingFilter?.tabsInScope,
    } as typeof filter;
  });

  return {
    ...state,
    filters: modifiedFilters,
  } as ExtendedNativeFiltersState;
}

export default function nativeFilterReducer(
  state: ExtendedNativeFiltersState = {
    filters: {},
  },
  action: AnyFilterAction,
) {
  switch (action.type) {
    case HYDRATE_DASHBOARD: {
      const incomingFilters = action.data.nativeFilters.filters;

      const preservedFilters: typeof incomingFilters = {};
      Object.entries(incomingFilters).forEach(([id, filter]) => {
        const existingFilter = state.filters[id];
        preservedFilters[id] = {
          ...filter,
          chartsInScope: existingFilter?.chartsInScope ?? filter.chartsInScope,
          tabsInScope: existingFilter?.tabsInScope ?? filter.tabsInScope,
        };
      });

      return {
        filters: preservedFilters,
      };
    }

    case SET_IN_SCOPE_STATUS_OF_FILTERS:
      return getInitialState({ filterConfig: action.filterConfig, state });

    case SET_NATIVE_FILTERS_CONFIG_COMPLETE:
      return handleFilterChangesComplete(state, action.filterChanges);

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

    case SET_HOVERED_NATIVE_FILTER:
      return {
        ...state,
        hoveredFilterId: action.id,
      };

    case UNSET_HOVERED_NATIVE_FILTER:
      return {
        ...state,
        hoveredFilterId: undefined,
      };

    case SET_HOVERED_CHART_CUSTOMIZATION:
      return {
        ...state,
        hoveredChartCustomizationId: action.id,
      };

    case UNSET_HOVERED_CHART_CUSTOMIZATION:
      return {
        ...state,
        hoveredChartCustomizationId: undefined,
      };

    case UPDATE_CASCADE_PARENT_IDS:
      return {
        ...state,
        filters: {
          ...state.filters,
          [action.id]: {
            ...state.filters[action.id],
            cascadeParentIds: action.parentIds,
          },
        },
      };

    // TODO handle SET_FILTER_CONFIG_FAIL action
    default:
      return state;
  }
}
