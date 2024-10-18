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
  Filter,
  FilterConfiguration,
  Filters,
  makeApi,
} from '@superset-ui/core';
import { Dispatch } from 'redux';
import { cloneDeep } from 'lodash';
import { setDataMaskForFilterChangesComplete } from 'src/dataMask/actions';
import { HYDRATE_DASHBOARD } from './hydrate';
import {
  dashboardInfoChanged,
  nativeFiltersConfigChanged,
} from './dashboardInfo';
import { SaveFilterChangesType } from '../components/nativeFilters/FiltersConfigModal/types';

export const SET_NATIVE_FILTERS_CONFIG_BEGIN =
  'SET_NATIVE_FILTERS_CONFIG_BEGIN';
export interface SetNativeFiltersConfigBegin {
  type: typeof SET_NATIVE_FILTERS_CONFIG_BEGIN;
  filterConfig: FilterConfiguration;
}

export const SET_NATIVE_FILTERS_CONFIG_COMPLETE =
  'SET_NATIVE_FILTERS_CONFIG_COMPLETE';
export interface SetNativeFiltersConfigComplete {
  type: typeof SET_NATIVE_FILTERS_CONFIG_COMPLETE;
  filterChanges: Filter[];
}

export const SET_NATIVE_FILTERS_CONFIG_FAIL = 'SET_NATIVE_FILTERS_CONFIG_FAIL';
export interface SetNativeFiltersConfigFail {
  type: typeof SET_NATIVE_FILTERS_CONFIG_FAIL;
  filterConfig: FilterConfiguration;
}
export const SET_IN_SCOPE_STATUS_OF_FILTERS = 'SET_IN_SCOPE_STATUS_OF_FILTERS';
export interface SetInScopeStatusOfFilters {
  type: typeof SET_IN_SCOPE_STATUS_OF_FILTERS;
  filterConfig: FilterConfiguration;
}

const isFilterChangesEmpty = (filterChanges: SaveFilterChangesType) =>
  Object.values(filterChanges).every(
    array => Array.isArray(array) && !array.length,
  );

export const setFilterConfiguration =
  (filterChanges: SaveFilterChangesType) =>
  async (dispatch: Dispatch, getState: () => any) => {
    if (isFilterChangesEmpty(filterChanges)) {
      return;
    }

    const { id } = getState().dashboardInfo;
    const oldFilters = getState().nativeFilters?.filters;

    dispatch({
      type: SET_NATIVE_FILTERS_CONFIG_BEGIN,
      filterChanges,
    });

    const updateFilters = makeApi<
      SaveFilterChangesType,
      { result: SaveFilterChangesType }
    >({
      method: 'PUT',
      endpoint: `/api/v1/dashboard/${id}/filters`,
    });
    try {
      const response = await updateFilters(filterChanges);
      dispatch(nativeFiltersConfigChanged(response.result));
      dispatch({
        type: SET_NATIVE_FILTERS_CONFIG_COMPLETE,
        filterChanges: response.result,
      });
      dispatch(setDataMaskForFilterChangesComplete(filterChanges, oldFilters));
    } catch (err) {
      dispatch({
        type: SET_NATIVE_FILTERS_CONFIG_FAIL,
        filterConfig: filterChanges,
      });
    }
  };

export const setInScopeStatusOfFilters =
  (
    filterScopes: {
      filterId: string;
      chartsInScope: number[];
      tabsInScope: string[];
    }[],
  ) =>
  async (dispatch: Dispatch, getState: () => any) => {
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
    // need to update native_filter_configuration in the dashboard metadata
    const metadata = cloneDeep(getState().dashboardInfo.metadata);
    const filterConfig: FilterConfiguration =
      metadata.native_filter_configuration;
    const mergedFilterConfig = filterConfig.map(filter => {
      const filterWithScope = filtersWithScopes.find(
        scope => scope.id === filter.id,
      );
      if (!filterWithScope) {
        return filter;
      }
      return { ...filterWithScope, ...filter };
    });
    metadata.native_filter_configuration = mergedFilterConfig;
    dispatch(
      dashboardInfoChanged({
        metadata,
      }),
    );
  };

type BootstrapData = {
  nativeFilters: {
    filters: Filters;
    filtersState: object;
  };
};

export interface SetBootstrapData {
  type: typeof HYDRATE_DASHBOARD;
  data: BootstrapData;
}

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

export const SET_HOVERED_NATIVE_FILTER = 'SET_HOVERED_NATIVE_FILTER';
export interface SetHoveredNativeFilter {
  type: typeof SET_HOVERED_NATIVE_FILTER;
  id: string;
}
export const UNSET_HOVERED_NATIVE_FILTER = 'UNSET_HOVERED_NATIVE_FILTER';
export interface UnsetHoveredNativeFilter {
  type: typeof UNSET_HOVERED_NATIVE_FILTER;
}

export function setHoveredNativeFilter(id: string): SetHoveredNativeFilter {
  return {
    type: SET_HOVERED_NATIVE_FILTER,
    id,
  };
}
export function unsetHoveredNativeFilter(): UnsetHoveredNativeFilter {
  return {
    type: UNSET_HOVERED_NATIVE_FILTER,
  };
}

export const UPDATE_CASCADE_PARENT_IDS = 'UPDATE_CASCADE_PARENT_IDS';
export interface UpdateCascadeParentIds {
  type: typeof UPDATE_CASCADE_PARENT_IDS;
  id: string;
  parentIds: string[];
}
export function updateCascadeParentIds(
  id: string,
  parentIds: string[],
): UpdateCascadeParentIds {
  return {
    type: UPDATE_CASCADE_PARENT_IDS,
    id,
    parentIds,
  };
}

export type AnyFilterAction =
  | SetNativeFiltersConfigBegin
  | SetNativeFiltersConfigComplete
  | SetNativeFiltersConfigFail
  | SetInScopeStatusOfFilters
  | SetBootstrapData
  | SetFocusedNativeFilter
  | UnsetFocusedNativeFilter
  | SetHoveredNativeFilter
  | UnsetHoveredNativeFilter
  | UpdateCascadeParentIds;
