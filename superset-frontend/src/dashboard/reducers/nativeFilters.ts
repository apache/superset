// DODO was here
import {
  AnyFilterAction,
  SET_FILTER_CONFIG_COMPLETE,
  SET_IN_SCOPE_STATUS_OF_FILTERS,
  SET_FOCUSED_NATIVE_FILTER,
  UNSET_FOCUSED_NATIVE_FILTER,
  SET_HOVERED_NATIVE_FILTER,
  UNSET_HOVERED_NATIVE_FILTER,
  UPDATE_CASCADE_PARENT_IDS,
  // DODO added start 44211751
  SET_FILTER_SETS_COMPLETE,
  CREATE_FILTER_SET_BEGIN,
  UPDATE_FILTER_SET_BEGIN,
  DELETE_FILTER_SET_BEGIN,
  // DODO added stop 44211751
} from 'src/dashboard/actions/nativeFilters';
import {
  FilterConfiguration,
  FilterSet, // DODO added 44211751
  NativeFiltersState,
} from '@superset-ui/core';
import { HYDRATE_DASHBOARD } from '../actions/hydrate';

export function getInitialState({
  filterSetsConfig, // DODO added 44211751
  filterConfig,
  state: prevState,
}: {
  filterSetsConfig?: FilterSet[]; // DODO added 44211751
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
  // DODO added 44211751
  if (filterSetsConfig) {
    const filterSets: Record<number, FilterSet> = {};
    filterSetsConfig.forEach(filtersSet => {
      const { id } = filtersSet;
      filterSets[id] = filtersSet;
    });
    state.filterSets = filterSets;
    state.pendingFilterSetId = undefined;
  } else {
    state.filterSets = prevState?.filterSets;
  }
  state.focusedFilterId = undefined;
  return state as NativeFiltersState;
}

export default function nativeFilterReducer(
  state: NativeFiltersState = {
    filters: {},
    filterSets: {}, // DODO added 44211751
  },
  action: AnyFilterAction,
) {
  switch (action.type) {
    case HYDRATE_DASHBOARD:
      return {
        filters: action.data.nativeFilters.filters,
        filterSets: action.data.nativeFilters.filterSets, // DODO added 44211751
      };

    case SET_FILTER_CONFIG_COMPLETE:
    case SET_IN_SCOPE_STATUS_OF_FILTERS:
      return getInitialState({ filterConfig: action.filterConfig, state });

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
    // DODO added start 44211751
    case SET_FILTER_SETS_COMPLETE:
      return getInitialState({
        filterSetsConfig: action.filterSets,
        state,
      });
    case CREATE_FILTER_SET_BEGIN:
      return {
        ...state,
        pendingFilterSetId: action.id,
      };
    case UPDATE_FILTER_SET_BEGIN:
      return {
        ...state,
        pendingFilterSetId: action.id,
      };
    case DELETE_FILTER_SET_BEGIN:
      return {
        ...state,
        pendingFilterSetId: action.id,
      };
    // DODO added stop 44211751
    // TODO handle SET_FILTER_CONFIG_FAIL action
    default:
      return state;
  }
}
