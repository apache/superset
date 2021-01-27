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
  SET_EXTRA_FORM_DATA,
  AnyFilterAction,
  SET_FILTER_CONFIG_COMPLETE,
} from 'src/dashboard/actions/nativeFilters';
import {
  Filter,
  FilterConfiguration,
  FilterState,
  NativeFiltersState,
} from 'src/dashboard/components/nativeFilters/types';
import { getSelectExtraFormData } from 'src/filters/utils';

export function getInitialFilterState(
  id: string,
  extraFormData = {},
): FilterState {
  return {
    id,
    extraFormData,
  };
}

function getInitialExtraFormData(filter: Filter, prevState?: FilterState) {
  if (filter?.defaultValue) {
    const [target] = filter.targets;
    return getSelectExtraFormData(
      target.column.name,
      [filter.defaultValue],
      false,
      filter.inverseSelection,
    );
  }
  if (prevState?.extraFormData) {
    return prevState.extraFormData;
  }
  return {};
}

export function getInitialState(
  filterConfig: FilterConfiguration,
  prevFiltersState: { [filterId: string]: FilterState },
): NativeFiltersState {
  const filters = {};
  const filtersState = {};
  const state = { filters, filtersState };
  filterConfig.forEach(filter => {
    const { id } = filter;
    filters[id] = filter;
    filtersState[id] = getInitialFilterState(
      id,
      getInitialExtraFormData(filter, prevFiltersState?.[id]),
    );
  });
  return state;
}

export default function nativeFilterReducer(
  state: NativeFiltersState = { filters: {}, filtersState: {} },
  action: AnyFilterAction,
) {
  const { filters, filtersState } = state;
  switch (action.type) {
    case SET_EXTRA_FORM_DATA:
      return {
        filters,
        filtersState: {
          ...filtersState,
          [action.filterId]: {
            ...filtersState[action.filterId],
            extraFormData: action.extraFormData,
          },
        },
      };

    case SET_FILTER_CONFIG_COMPLETE:
      return getInitialState(action.filterConfig, filtersState);

    // TODO handle SET_FILTER_CONFIG_FAIL action
    default:
      return state;
  }
}
