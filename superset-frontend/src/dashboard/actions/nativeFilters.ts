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

import { makeApi } from '@superset-ui/core';
import { Dispatch } from 'redux';
import { FilterConfiguration } from 'src/dashboard/components/nativeFilters/types';
import {
  SET_DATA_MASK_FOR_FILTER_CONFIG_FAIL,
  setDataMaskForFilterConfigComplete,
} from 'src/dataMask/actions';
import { HYDRATE_DASHBOARD } from './hydrate';
import { dashboardInfoChanged } from './dashboardInfo';
import {
  Filters,
  FilterSet,
  FilterSetFullData,
  FilterSets,
} from '../reducers/types';
import { DashboardInfo, RootState } from '../types';

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
export const SET_IN_SCOPE_STATUS_OF_FILTERS = 'SET_IN_SCOPE_STATUS_OF_FILTERS';
export interface SetInScopeStatusOfFilters {
  type: typeof SET_IN_SCOPE_STATUS_OF_FILTERS;
  filterConfig: FilterConfiguration;
}
export const SET_FILTER_SETS_BEGIN = 'SET_FILTER_SETS_BEGIN';
export interface SetFilterSetsBegin {
  type: typeof SET_FILTER_SETS_BEGIN;
}
export const SET_FILTER_SETS_COMPLETE = 'SET_FILTER_SETS_COMPLETE';
export interface SetFilterSetsComplete {
  type: typeof SET_FILTER_SETS_COMPLETE;
  filterSets: FilterSet[];
}
export const SET_FILTER_SETS_FAIL = 'SET_FILTER_SETS_FAIL';
export interface SetFilterSetsFail {
  type: typeof SET_FILTER_SETS_FAIL;
}

export const CREATE_FILTER_SET_BEGIN = 'CREATE_FILTER_SET_BEGIN';
export interface CreateFilterSetBegin {
  type: typeof CREATE_FILTER_SET_BEGIN;
}
export const CREATE_FILTER_SET_COMPLETE = 'CREATE_FILTER_SET_COMPLETE';
export interface CreateFilterSetComplete {
  type: typeof CREATE_FILTER_SET_COMPLETE;
  filterSet: FilterSet;
}
export const CREATE_FILTER_SET_FAIL = 'CREATE_FILTER_SET_FAIL';
export interface CreateFilterSetFail {
  type: typeof CREATE_FILTER_SET_FAIL;
}

export const setFilterConfiguration = (
  filterConfig: FilterConfiguration,
) => async (dispatch: Dispatch, getState: () => any) => {
  dispatch({
    type: SET_FILTER_CONFIG_BEGIN,
    filterConfig,
  });
  const { id, metadata } = getState().dashboardInfo;
  const oldFilters = getState().nativeFilters?.filters;

  // TODO extract this out when makeApi supports url parameters
  const updateDashboard = makeApi<
    Partial<DashboardInfo>,
    { result: DashboardInfo }
  >({
    method: 'PUT',
    endpoint: `/api/v1/dashboard/${id}`,
  });

  const mergedFilterConfig = filterConfig.map(filter => {
    const oldFilter = oldFilters[filter.id];
    if (!oldFilter) {
      return filter;
    }
    return { ...oldFilter, ...filter };
  });

  try {
    const response = await updateDashboard({
      json_metadata: JSON.stringify({
        ...metadata,
        native_filter_configuration: mergedFilterConfig,
      }),
    });
    dispatch(
      dashboardInfoChanged({
        metadata: JSON.parse(response.result.json_metadata),
      }),
    );
    dispatch({
      type: SET_FILTER_CONFIG_COMPLETE,
      filterConfig: mergedFilterConfig,
    });
    dispatch(
      setDataMaskForFilterConfigComplete(mergedFilterConfig, oldFilters),
    );
  } catch (err) {
    dispatch({
      type: SET_FILTER_CONFIG_FAIL,
      filterConfig: mergedFilterConfig,
    });
    dispatch({
      type: SET_DATA_MASK_FOR_FILTER_CONFIG_FAIL,
      filterConfig: mergedFilterConfig,
    });
  }
};

export const setInScopeStatusOfFilters = (
  filterScopes: {
    filterId: string;
    chartsInScope: number[];
    tabsInScope: string[];
  }[],
) => async (dispatch: Dispatch, getState: () => any) => {
  const filters = getState().nativeFilters?.filters;
  const filtersWithScopes = filterScopes.map(scope => ({
    ...filters[scope.filterId],
    chartsInScope: scope.chartsInScope,
    tabsInScope: scope.tabsInScope,
  }));
  dispatch({
    type: SET_IN_SCOPE_STATUS_OF_FILTERS,
    filterConfig: filtersWithScopes,
  });
};

type BootstrapData = {
  nativeFilters: {
    filters: Filters;
    filterSets: FilterSets;
    filtersState: object;
  };
};

export interface SetBootstrapData {
  type: typeof HYDRATE_DASHBOARD;
  data: BootstrapData;
}

export const getFilterSets = () => async (
  dispatch: Dispatch,
  getState: () => RootState,
) => {
  const dashboardId = getState().dashboardInfo.id;
  const fetchFilterSets = makeApi<
    null,
    {
      count: number;
      ids: number[];
      result: FilterSetFullData[];
    }
  >({
    method: 'GET',
    endpoint: `/api/v1/dashboard/${dashboardId}/filtersets`,
  });

  dispatch({
    type: SET_FILTER_SETS_BEGIN,
  });

  const response = await fetchFilterSets(null);

  dispatch({
    type: SET_FILTER_SETS_COMPLETE,
    filterSets: response.ids.map((id, i) => ({
      ...response.result[i].params,
      id,
      name: response.result[i].name,
    })),
  });
};

export const createFilterSet = (filterSet: Omit<FilterSet, 'id'>) => async (
  dispatch: Function,
  getState: () => RootState,
) => {
  const dashboardId = getState().dashboardInfo.id;
  const postFilterSets = makeApi<
    Partial<FilterSetFullData & { json_metadata: any }>,
    {
      count: number;
      ids: number[];
      result: FilterSetFullData[];
    }
  >({
    method: 'POST',
    endpoint: `/api/v1/dashboard/${dashboardId}/filtersets`,
  });

  dispatch({
    type: CREATE_FILTER_SET_BEGIN,
  });

  const response = await postFilterSets({
    name: filterSet.name,
    owner_type: 'Dashboard',
    owner_id: dashboardId,
    json_metadata: filterSet,
  });

  console.log(response);
  dispatch({
    type: CREATE_FILTER_SET_COMPLETE,
  });
  dispatch(getFilterSets());
};

export const setFilterSetsConfiguration = (filterSets: FilterSet[]) => async (
  dispatch: Dispatch,
  getState: () => any,
) => {
  dispatch({
    type: SET_FILTER_SETS_BEGIN,
    filterSets,
  });
  const { id } = getState().dashboardInfo;

  // TODO extract this out when makeApi supports url parameters
  const updateDashboard = makeApi<
    Partial<DashboardInfo>,
    { result: DashboardInfo }
  >({
    method: 'PUT',
    endpoint: `/api/v1/dashboard/${id}`,
  });

  try {
    const response = await updateDashboard({
      // json_metadata: JSON.stringify({
      //   // ...metadata,
      //   // filter_sets_configuration: filterSets,
      // }),
    });
    const newMetadata = JSON.parse(response.result.json_metadata);
    dispatch(
      dashboardInfoChanged({
        metadata: newMetadata,
      }),
    );
    dispatch({
      type: SET_FILTER_SETS_COMPLETE,
      filterSets: newMetadata?.filter_sets_configuration,
    });
  } catch (err) {
    dispatch({ type: SET_FILTER_SETS_FAIL, filterSets });
  }
};

export const SET_FOCUSED_NATIVE_FILTER = 'SET_FOCUSED_NATIVE_FILTER';
export interface SetFocusedNativeFilter {
  type: typeof SET_FOCUSED_NATIVE_FILTER;
  id: string;
}
export const UNSET_FOCUSED_NATIVE_FILTER = 'UNSET_FOCUSED_NATIVE_FILTER';
export interface UnsetFocusedNativeFilter {
  type: typeof UNSET_FOCUSED_NATIVE_FILTER;
}

export function setFocusedNativeFilter(id: string): SetFocusedNativeFilter {
  return {
    type: SET_FOCUSED_NATIVE_FILTER,
    id,
  };
}
export function unsetFocusedNativeFilter(): UnsetFocusedNativeFilter {
  return {
    type: UNSET_FOCUSED_NATIVE_FILTER,
  };
}

export type AnyFilterAction =
  | SetFilterConfigBegin
  | SetFilterConfigComplete
  | SetFilterConfigFail
  | SetFilterSetsBegin
  | SetFilterSetsComplete
  | SetFilterSetsFail
  | SetInScopeStatusOfFilters
  | SetBootstrapData
  | SetFocusedNativeFilter
  | UnsetFocusedNativeFilter
  | CreateFilterSetBegin
  | CreateFilterSetComplete
  | CreateFilterSetFail;
